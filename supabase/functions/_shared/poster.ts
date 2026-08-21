// ============================================================================
// MenuFlow — Poster POS adapter
// ============================================================================
// The only file in this project that calls `fetch()` against joinposter.com.
// Everything else in pos-poster-menu-sync/pos-poster-order-push talks to THIS
// module's two exported functions, never to Poster directly — so a future
// real-account test only has one clearly-named surface to point at, and a
// second POS provider (iiko, Jowi, ...) is a new sibling file implementing
// the same `PosAdapter` shape, not a rewrite of either Edge Function.
//
// IMPORTANT — verify against Poster's live docs before a real integration
// test: the method names/payload shapes below (menu.getCategories,
// menu.getProducts, incomingOrders.createIncomingOrder) reflect Poster's
// publicly documented REST API as of this writing, but Poster's API can
// change and this file was written without a live merchant account to
// confirm against. Treat the shapes here as a strong starting point, not a
// guarantee.
// ============================================================================

const POSTER_API_BASE = 'https://joinposter.com/api';

export interface PosterCategory {
  externalId: string;
  name: string;
}

export interface PosterProduct {
  externalId: string;
  categoryExternalId: string;
  name: string;
  price: number;
  description: string;
  isAvailable: boolean;
}

export interface PosterMenu {
  categories: PosterCategory[];
  products: PosterProduct[];
}

export interface PosOrderItem {
  productName: string;
  posterExternalId: string | null;
  quantity: number;
  price: number;
}

export interface PosOrderPayload {
  orderId: string;
  tableNumber: number | null;
  total: number;
  note: string;
  items: PosOrderItem[];
}

// Every provider this project ever adds implements this shape. Only Poster
// is implemented today (see posterAdapter below) — the interface itself is
// the seam for iiko/Jowi/etc., deliberately not exercised yet.
export interface PosAdapter {
  fetchMenu(token: string): Promise<PosterMenu>;
  pushOrder(token: string, order: PosOrderPayload): Promise<{ externalOrderId: string }>;
}

class PosterApiError extends Error {
  constructor(method: string, detail: string) {
    super(`Poster API (${method}) failed: ${detail}`);
    this.name = 'PosterApiError';
  }
}

// Poster's REST API takes the access token as a `token` query param, not an
// Authorization header — this is Poster's own convention, not something
// chosen here.
async function posterGet(method: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${POSTER_API_BASE}/${method}`);
  url.searchParams.set('token', token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new PosterApiError(method, body?.error?.message || body?.error || `HTTP ${res.status}`);
  }
  return body.response;
}

async function posterPost(method: string, token: string, payload: Record<string, unknown>) {
  const url = new URL(`${POSTER_API_BASE}/${method}`);
  url.searchParams.set('token', token);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    throw new PosterApiError(method, body?.error?.message || body?.error || `HTTP ${res.status}`);
  }
  return body.response;
}

async function fetchMenu(token: string): Promise<PosterMenu> {
  const [rawCategories, rawProducts] = await Promise.all([
    posterGet('menu.getCategories', token),
    posterGet('menu.getProducts', token),
  ]);

  const categories: PosterCategory[] = (Array.isArray(rawCategories) ? rawCategories : []).map((c: Record<string, unknown>) => ({
    externalId: String(c.category_id),
    name: String(c.category_name ?? ''),
  }));

  const products: PosterProduct[] = (Array.isArray(rawProducts) ? rawProducts : []).map((p: Record<string, unknown>) => ({
    externalId: String(p.product_id),
    categoryExternalId: String(p.menu_category_id ?? ''),
    name: String(p.product_name ?? ''),
    // Poster prices are typically integer kopecks/qəpik (price * 100) —
    // divide down to the same decimal-currency unit MenuFlow's `products.price`
    // (numeric(10,2)) already uses everywhere else.
    price: Number(p.price ?? 0) / 100,
    description: String(p.ingredients ?? p.product_description ?? ''),
    isAvailable: Number(p.hidden ?? 0) === 0,
  }));

  return { categories, products };
}

async function pushOrder(token: string, order: PosOrderPayload): Promise<{ externalOrderId: string }> {
  const response = await posterPost('incomingOrders.createIncomingOrder', token, {
    incoming_order: {
      comment: order.note || undefined,
      service_mode: 1, // dine-in — see Poster docs' service_mode enum
      table: order.tableNumber ?? undefined,
      products: order.items.map((item) => ({
        product_id: item.posterExternalId ?? undefined,
        product_name: item.posterExternalId ? undefined : item.productName,
        num: item.quantity,
        price: Math.round(item.price * 100),
      })),
    },
  });

  const externalOrderId = String(response?.incoming_order_id ?? response?.id ?? '');
  if (!externalOrderId) throw new PosterApiError('incomingOrders.createIncomingOrder', 'no order id in response');
  return { externalOrderId };
}

export const posterAdapter: PosAdapter = { fetchMenu, pushOrder };
