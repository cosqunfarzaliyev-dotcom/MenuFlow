// ============================================================================
// MenuFlow — pos-poster-order-push (Edge Function)
// ============================================================================
// Third backend component. Pushes a just-placed order to Poster POS so the
// kitchen sees it without the QR-ordering guest ever touching Poster. Called
// exclusively by public.push_order_to_pos() — the AFTER INSERT trigger on
// public.orders (see supabase/migrations/0026_pos_integration.sql, section
// 5) — via pg_net's net.http_post(), never from a browser.
//
// AUTH MODEL — deliberately different from every other Edge Function here.
// A DB-trigger-initiated call has no user JWT at all, so there is no
// callerClient/auth.getUser() step in this file. verify_jwt is set to FALSE
// at deploy time (the one deliberate exception to this project's gateway-
// level JWT check) — the REAL gate is a shared secret:
//   `x-pos-push-secret` header === Deno.env.get('POS_ORDER_PUSH_SECRET')
// which must match the value stored in Supabase Vault as
// 'pos_order_push_secret' (provisioned once via execute_sql, see 0026's
// section 6 — never in the repo, same reasoning as SUPABASE_SERVICE_ROLE_KEY
// never appearing in code).
//
// This function is internet-reachable by design (a trigger can't present a
// browser session), so the secret comparison is the entire perimeter —
// treat POS_ORDER_PUSH_SECRET with the same care as a service-role key.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { posterAdapter } from '../_shared/poster.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-pos-push-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const fail = (status: number, code: string, message: string) => json(status, { ok: false, code, message });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pushSecret = Deno.env.get('POS_ORDER_PUSH_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !pushSecret) {
    // NOTE: this branch runs BEFORE adminClient exists, so it structurally
    // cannot write order_push_status back. That is exactly why the trigger
    // stamps 'pending' + order_push_last_attempt_at before we are called
    // (0027): a row stuck at 'pending' with an old attempt timestamp means
    // "the function never answered" — in practice, POS_ORDER_PUSH_SECRET is
    // not set on this deployment. The Admin UI surfaces that as a stale state
    // instead of silently reading "never synced".
    return fail(500, 'SERVER_ERROR', 'Edge function environment is not configured.');
  }

  // --- 1. THE authorization gate — shared secret, not a JWT ---------------
  // Deliberately writes NO status here: this branch is reachable by any
  // unauthenticated caller on the internet, so writing pos_integrations from
  // it would let a stranger stamp a tenant's row. The secret comparison is
  // the entire perimeter — everything past it is trusted, nothing before it is.
  const suppliedSecret = req.headers.get('x-pos-push-secret') ?? '';
  if (suppliedSecret !== pushSecret) {
    return fail(401, 'UNAUTHORIZED', 'Etibarsız çağırış.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 2. Validate input ----------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const restaurantId = typeof body.restaurant_id === 'string' ? body.restaurant_id.trim() : '';
  if (!UUID_RE.test(orderId) || !UUID_RE.test(restaurantId)) {
    return fail(400, 'INVALID_INPUT', 'order_id/restaurant_id düzgün deyil.');
  }

  // --- 3. Re-check the integration independently of the trigger's own
  //        check — "never trust the caller", even when the caller is our
  //        own trigger (same discipline every SECURITY DEFINER RPC in this
  //        project follows). ------------------------------------------------
  const { data: integration, error: integrationError } = await adminClient
    .from('pos_integrations')
    .select('api_token, sync_orders_enabled')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'poster')
    .maybeSingle();

  if (integrationError) return fail(500, 'SERVER_ERROR', 'İnteqrasiya yoxlanılmadı.');
  if (!integration || !integration.api_token || !integration.sync_orders_enabled) {
    // Not an error from the trigger's point of view (it already checked
    // sync_orders_enabled before calling) — but report it plainly rather
    // than pretending success, in case this was invoked directly for
    // debugging.
    //
    // We DO write status here (unlike the 401 branch above): we are past the
    // secret gate, so the caller is trusted. This resolves the race where an
    // admin toggles order-push off between the trigger firing and this call
    // landing — without it, the row would sit at 'pending' forever and read
    // as "misconfigured" when it was just switched off.
    if (integration) {
      await adminClient
        .from('pos_integrations')
        .update({ order_push_status: 'never', order_push_error: null })
        .eq('restaurant_id', restaurantId)
        .eq('provider', 'poster');
    }
    return fail(409, 'NOT_CONFIGURED', 'Poster POS inteqrasiyası quraşdırılmayıb və ya sifariş ötürülməsi sönülüdür.');
  }

  // --- 4. Load the order + its items ---------------------------------------
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, table_id, total, note, restaurant_tables(table_number)')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (orderError) return fail(500, 'SERVER_ERROR', 'Sifariş oxunmadı.');
  if (!order) return fail(404, 'ORDER_NOT_FOUND', 'Sifariş tapılmadı.');

  const { data: items, error: itemsError } = await adminClient
    .from('order_items')
    .select('quantity, price, product:products(name, pos_external_id)')
    .eq('order_id', orderId);
  if (itemsError) return fail(500, 'SERVER_ERROR', 'Sifariş sətirləri oxunmadı.');

  // --- 5. Push to Poster, then write the result back -----------------------
  try {
    const result = await posterAdapter.pushOrder(integration.api_token, {
      orderId: order.id,
      tableNumber: order.restaurant_tables?.table_number ?? null,
      total: Number(order.total) || 0,
      note: order.note || '',
      items: (items || []).map((item) => ({
        productName: item.product?.name || '',
        posterExternalId: item.product?.pos_external_id || null,
        quantity: item.quantity,
        price: Number(item.price) || 0,
      })),
    });

    await adminClient
      .from('pos_integrations')
      .update({
        order_push_status: 'success',
        order_push_error: null,
        order_push_synced_at: new Date().toISOString(),
        order_push_last_attempt_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'poster');

    return json(200, { ok: true, posterOrderId: result.externalOrderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await adminClient
      .from('pos_integrations')
      .update({
        order_push_status: 'error',
        order_push_error: message,
        order_push_synced_at: new Date().toISOString(),
        order_push_last_attempt_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'poster');
    // 200, not 502: the trigger that called us fires-and-forgets (pg_net is
    // async, nothing reads this response), and a non-2xx here would just be
    // logged nowhere useful. The real signal is order_push_status written
    // above, which the Admin UI surfaces.
    return json(200, { ok: false, code: 'POSTER_PUSH_FAILED', message });
  }
});
