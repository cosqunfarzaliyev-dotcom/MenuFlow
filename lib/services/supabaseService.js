import { supabase, supabaseReady } from '@/lib/supabase';

const warnMissingClient = () => {
  if (!supabaseReady) {
    console.warn('Supabase client is not ready; skipping Supabase operation.');
  }
};

const isUuid = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Orders/alerts can arrive with either a DB UUID or a plain table_number
// (e.g. from a QR code URL like /menu/acme-grill/12). table_number is only
// unique *within* a restaurant, so restaurantId is required to resolve it.
const resolveTableId = async (tableId, restaurantId) => {
  if (!tableId || isUuid(tableId)) return tableId;
  let query = supabase.from('restaurant_tables').select('id').eq('table_number', Number(tableId));
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data: dbTable } = await query.single();
  return dbTable ? dbTable.id : tableId;
};

// products.prep_time_minutes is an integer, but the customer UI renders
// product.prepTime as a ready-to-display string — the seed data in
// data/menu.json carries its own ("12-15 dəq") and never passes through this
// normalizer. Formatting here instead of in ProductCard/ProductDetailModal
// keeps both sources rendering identically and needs no change to either
// component. (The "dəq" unit is hardcoded like the rest of the app's
// Azerbaijani UI strings; it moves into lib/translations.js when the
// localization work happens.)
const formatPrepTime = (minutes) => {
  if (minutes === null || minutes === undefined || minutes === '') return '';
  const n = Number(minutes);
  return Number.isFinite(n) ? `${n} dəq` : '';
};

// Same split as formatPrepTime above, and for the same reason: the DB stores a
// bare number (0031_product_nutrition.sql) while data/menu.json's seed rows
// carry a pre-formatted string ("780 kkal") and never pass through this
// normalizer. Formatting here keeps `product.calories` a display string in
// BOTH modes, so ProductDetailModal needs no branch — the raw value is exposed
// separately for the Admin form to round-trip.
// (Units are Azerbaijani-only for now, like "dəq" above; they move into
// lib/translations.js when the CustomerApp localization work happens.)
const formatCalories = (kcal) => {
  if (kcal === null || kcal === undefined || kcal === '') return '';
  const n = Number(kcal);
  return Number.isFinite(n) ? `${n} kkal` : '';
};

// numeric(6,1) arrives from PostgREST as a string ("36.0"); Number() collapses
// that back to 36 so whole grams don't render a pointless ".0".
const formatGrams = (grams) => {
  if (grams === null || grams === undefined || grams === '') return '';
  const n = Number(grams);
  return Number.isFinite(n) ? `${n} q` : '';
};

const normalizeProduct = (product) => {
  if (!product) return null;
  return {
    ...product,
    id: product.id?.toString(),
    // The frontend has always called the category FK `category` (AdminApp
    // product form, CustomerApp category filter, AnalyticsDashboard category
    // split). Mapping it here keeps category_id as the single source of truth
    // rather than duplicating the relationship in a second column
    // (see supabase/migrations/0017_fix_product_and_order_schema.sql).
    category: product.category_id?.toString() || null,
    isPopular: product.is_popular ?? false,
    isChefChoice: product.is_chef_choice ?? false,
    isSpicy: product.is_spicy ?? false,
    isVegetarian: product.is_vegetarian ?? false,
    // Raw value for round-tripping back to the column (Admin form), formatted
    // value for the existing display components.
    prepTimeMinutes: product.prep_time_minutes ?? null,
    prepTime: formatPrepTime(product.prep_time_minutes),
    // Nutrition (0031). Same raw-for-the-form / formatted-for-display split.
    caloriesValue: product.calories ?? null,
    calories: formatCalories(product.calories),
    proteinValue: product.protein_g ?? null,
    protein: formatGrams(product.protein_g),
    carbsValue: product.carbs_g ?? null,
    carbs: formatGrams(product.carbs_g),
    fatValue: product.fat_g ?? null,
    fat: formatGrams(product.fat_g),
  };
};

const normalizeTable = (table) => {
  if (!table) return null;
  return {
    ...table,
    id: table.id?.toString(),
    table_number: table.table_number?.toString(),
    name: table.name || `Masa ${table.table_number}`,
  };
};

const normalizeOrderItem = (item) => {
  return {
    id: item.id?.toString(),
    quantity: item.quantity,
    price: item.price,
    note: item.note || '',
    product: normalizeProduct(item.product),
  };
};

const normalizeOrder = (order) => {
  if (!order) return null;
  return {
    id: order.id?.toString(),
    table:
      order.restaurant_tables?.table_number?.toString() ||
      order.table_number?.toString() ||
      order.table_id?.toString(),
    tableId: order.table_id?.toString(),
    status: order.status,
    total: order.total,
    // Order-level note ("Ümumi masa qeydi") — distinct from the per-product
    // kitchen request carried on each order_items row.
    note: order.note || '',
    paymentMethod: order.payment_method || order.paymentMethod,
    paymentMethodLabel: order.payment_method_label || order.paymentMethodLabel,
    // 0025_order_payment_status.sql — orthogonal to `status`: an order can
    // be 'served' and still 'unpaid'. Defaults to 'unpaid' so an order row
    // that predates the migration (or omits the column in some select)
    // never silently reads as settled.
    paymentStatus: order.payment_status || order.paymentStatus || 'unpaid',
    paidAt: order.paid_at || order.paidAt || null,
    time: order.created_at || order.time || new Date().toISOString(),
    items: (order.order_items || []).map(normalizeOrderItem),
  };
};

const normalizeAlert = (alert) => {
  if (!alert) return null;
  return {
    id: alert.id?.toString(),
    table:
      alert.restaurant_tables?.table_number?.toString() ||
      alert.table_number?.toString() ||
      alert.table_id?.toString(),
    tableId: alert.table_id?.toString(),
    type: alert.type,
    paymentMethod: alert.payment_method || alert.paymentMethod,
    paymentMethodLabel: alert.payment_method_label || alert.paymentMethodLabel,
    note: alert.note || '',
    status: alert.status,
    // How many times this call has been repeated/edited while still active
    // (bumped by upsert_alert instead of creating a duplicate row).
    callCount: alert.call_count || 1,
    // `time` drives display + sort recency: prefer updated_at so a repeated
    // or edited call floats back to the top of the staff panel list.
    time: alert.updated_at || alert.created_at || alert.time || new Date().toISOString(),
    createdAt: alert.created_at || alert.time || new Date().toISOString(),
  };
};

const normalizeCategory = (category) => {
  if (!category) return null;
  return {
    ...category,
    id: category.id?.toString(),
  };
};

// normalizeProduct and normalizeProductRow used to be separate, identical
// functions. Kept as one alias so existing call sites below don't need renaming.
const normalizeProductRow = normalizeProduct;

// All fetch* functions below take an optional restaurantId. It's required
// in a multi-tenant setup (customer/staff/admin apps always know which
// restaurant they belong to) but left optional so the functions degrade
// gracefully if ever called without one (returns everything RLS allows).

const PUBLIC_TABLE_COLUMNS = 'id, restaurant_id, table_number, name, created_at';

export const fetchTables = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('restaurant_tables').select(PUBLIC_TABLE_COLUMNS).order('table_number', { ascending: true });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchTables error:', error);
    return [];
  }
  return (data || []).map(normalizeTable);
};

// QR kod tokenləri (imzalı, sifariş/çağırış spoof qorunması üçün) adi
// restaurant_tables select-ində gəlmir — sütun səviyyəsində gizlədilib (bax:
// 0008_qr_token_verification.sql). Yalnız bu RPC ilə, is_staff_of yoxlaması
// keçdikdən sonra qayıdır. Admin Panel -> "QR Kodlar" bunu istifadə edir.
export const fetchRestaurantQrTokens = async (restaurantId) => {
  if (!supabaseReady || !restaurantId) return {};
  const { data, error } = await supabase.rpc('get_restaurant_qr_tokens', { p_restaurant_id: restaurantId });
  if (error) {
    console.error('fetchRestaurantQrTokens error:', error);
    return {};
  }
  const byTableId = {};
  (data || []).forEach((row) => {
    byTableId[row.id?.toString()] = row.qr_token;
  });
  return byTableId;
};

export const fetchTableByNumber = async (tableNumber, restaurantId) => {
  if (!supabaseReady) return null;
  let query = supabase.from('restaurant_tables').select(PUBLIC_TABLE_COLUMNS).eq('table_number', Number(tableNumber));
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query.single();
  if (error) {
    console.error('fetchTableByNumber error:', error);
    return null;
  }
  return normalizeTable(data);
};

export const fetchProducts = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('products').select('*').order('name', { ascending: true });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchProducts error:', error);
    return [];
  }
  return (data || []).map(normalizeProductRow);
};

export const fetchCategories = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('categories').select('*').order('name', { ascending: true });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchCategories error:', error);
    return [];
  }
  return (data || []).map(normalizeCategory);
};

export const fetchOrders = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase
    .from('orders')
    .select(`id, table_id, status, total, note, payment_method, payment_method_label, payment_status, paid_at, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
    .order('created_at', { ascending: true });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchOrders error:', error);
    return [];
  }
  return (data || []).map(normalizeOrder);
};

export const fetchAlerts = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase
    .from('alerts')
    .select('id, table_id, type, payment_method, payment_method_label, note, status, created_at, updated_at, call_count, restaurant_tables(table_number)')
    // Most recently created OR bumped (repeat/edited) call first, so a
    // table calling again — or switching cash -> card on a bill request —
    // always resurfaces at the top instead of staying buried under newer
    // calls from other tables.
    .order('updated_at', { ascending: false });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchAlerts error:', error);
    return [];
  }
  return (data || []).map(normalizeAlert);
};

export const fetchOrderById = async (orderId) => {
  if (!supabaseReady) return null;
  const { data, error } = await supabase
    .from('orders')
    .select(`id, table_id, status, total, note, payment_method, payment_method_label, payment_status, paid_at, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
    .eq('id', orderId)
    .single();
  if (error) {
    console.error('fetchOrderById error:', error);
    return null;
  }
  return normalizeOrder(data);
};

// Anon (customer) equivalent of fetchOrders — deliberately NOT a `.from('orders')`
// select. `orders` carries only 3 RLS policies and all three are
// `{authenticated} using (is_staff_of(restaurant_id))` (confirmed against the
// live project's pg_policies) — there has never been an anon SELECT policy on
// orders. A customer calling fetchOrders() gets back `[]` silently (RLS
// filters to zero rows, no error), which is why "Aktiv Sifarişlərim" always
// rendered empty and billTotal was always 0 before 0025.
// get_table_orders() (0025_order_payment_status.sql) closes this the same way
// get_public_restaurant() closes anon restaurant reads (0020): a narrow
// SECURITY DEFINER function with an explicit column list, gated by the same
// verify_qr_token() check place_order()/upsert_alert() already use — not a
// broadened RLS policy. The RPC's JSON shape mirrors PostgREST's own
// (order_items[], restaurant_tables.table_number) so normalizeOrder() below
// needs no branching per caller.
export const fetchTableOrders = async (restaurantId, tableId, qrToken) => {
  if (!supabaseReady || !restaurantId || !tableId) return [];
  const { data, error } = await supabase.rpc('get_table_orders', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_qr_token: qrToken,
  });
  if (error) {
    console.error('fetchTableOrders error:', error);
    return [];
  }
  return (data || []).map(normalizeOrder);
};

// Staff-only (settle_table_payment is authenticated-only, anon EXECUTE is
// revoked — see the migration). Closes a table's WHOLE unpaid balance in one
// call rather than per-order, matching how a restaurant actually closes a
// bill; also resolves the table's active 'bill' alert in the same server-side
// transaction. `paid: false` is the reversal path for a mis-tap.
export const settleTablePayment = async ({ restaurantId, tableId, paymentMethod, paymentMethodLabel, paid = true }) => {
  if (!supabaseReady) return { result: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.rpc('settle_table_payment', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_payment_method: paymentMethod || null,
    p_payment_method_label: paymentMethodLabel || null,
    p_paid: paid,
  });
  if (error) {
    console.error('settleTablePayment error:', error);
    return { result: null, error };
  }
  return { result: data, error: null };
};

// ---------------------------------------------------------------------------
// Restoran heyəti (Admin -> İstifadəçilər, oxu-only). profiles_self_read RLS
// siyasəti bir restaurant_admin-in öz sətrindən başka heç nə görməsinə icazə
// vermir (0001_multi_tenant_saas.sql) — get_restaurant_staff() (0028) dar,
// SECURITY DEFINER RPC-dir, get_pos_integration_status()-un eyni forması.
// Hesab yaratma/silmə/rol dəyişmə BURADAN keçmir — hələ də ciddi şəkildə
// super-admin-only-dur (bax capabilityService.js-in D1 qərar şərhi).
// ---------------------------------------------------------------------------
export const fetchRestaurantStaff = async (restaurantId) => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.rpc('get_restaurant_staff', { p_restaurant_id: restaurantId });
  if (error) {
    console.error('fetchRestaurantStaff error:', error);
    return [];
  }
  return data || [];
};

// ---------------------------------------------------------------------------
// POS (kassa) inteqrasiyası — Poster POS. public.pos_integrations-a birbaşa
// PostgREST çıxışı yoxdur (0026_pos_integration.sql — sıfır RLS policy, sıfır
// grant); aşağıdakı üç funksiya yeganə giriş yoludur, hər biri bir SECURITY
// DEFINER RPC-yə map olunur. api_token heç bir RPC nəticəsində qayıtmır —
// yalnız has_token boolean.
// ---------------------------------------------------------------------------
export const fetchPosIntegrationStatus = async (restaurantId) => {
  if (!supabaseReady) return null;
  const { data, error } = await supabase.rpc('get_pos_integration_status', { p_restaurant_id: restaurantId });
  if (error) {
    console.error('fetchPosIntegrationStatus error:', error);
    return null;
  }
  return data;
};

export const savePosCredentials = async ({ restaurantId, accountIdentifier, apiToken, syncMenuEnabled, syncOrdersEnabled }) => {
  if (!supabaseReady) return { status: null, error: new Error('Supabase not ready') };
  // apiToken undefined/'' ötürülürsə RPC-nin özü mövcud token-i saxlayır
  // (upsert_pos_credentials-in p_api_token default-u) — admin token-i
  // yenidən yazmadan yalnız toggle-ları dəyişə bilsin.
  const { data, error } = await supabase.rpc('upsert_pos_credentials', {
    p_restaurant_id: restaurantId,
    p_account_identifier: accountIdentifier ?? null,
    p_api_token: apiToken || null,
    p_sync_menu_enabled: syncMenuEnabled ?? null,
    p_sync_orders_enabled: syncOrdersEnabled ?? null,
  });
  if (error) {
    console.error('savePosCredentials error:', error);
    return { status: null, error };
  }
  return { status: data, error: null };
};

export const disconnectPosIntegration = async (restaurantId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.rpc('disconnect_pos_integration', { p_restaurant_id: restaurantId });
  if (error) console.error('disconnectPosIntegration error:', error);
  return { error };
};

// Browser-invoked Edge Function (pos-poster-menu-sync) — the caller's own
// session JWT rides along automatically (functions.invoke() attaches it),
// re-verified server-side. Same error.context unwrapping as
// createOrAssignRestaurantUser: functions.invoke() discards the response
// body from error.message on any non-2xx, the real {code, message} only
// lives in error.context (a Response object).
// `dryRun: true` calls the same Edge Function in read-only mode — it fetches
// from Poster and reports counts but writes nothing (no upsert, no
// menu_sync_status). Lets an admin prove the token + API shape work before
// a bad response half-writes the catalogue (see _shared/poster.ts's header:
// the Poster method names/payload shapes were never verified against a live
// merchant account).
export const syncPosMenuNow = async (restaurantId, { dryRun = false } = {}) => {
  if (!supabaseReady) return { result: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.functions.invoke('pos-poster-menu-sync', {
    body: { restaurantId, dryRun },
  });
  if (error) {
    let message = error.message;
    let code = null;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.message) message = parsed.message;
      if (parsed?.code) code = parsed.code;
    } catch {
      // Non-JSON body (gateway-level failure, network error) — keep the
      // original message rather than masking the failure entirely.
    }
    console.error('syncPosMenuNow error:', code, message);
    const wrapped = new Error(message);
    wrapped.code = code;
    return { result: null, error: wrapped };
  }
  return { result: data, error: null };
};

// `total` is accepted for backwards compatibility but intentionally unused:
// it (and every line's price) used to be trusted from the caller, which let
// anyone editing client state or POSTing to PostgREST directly submit
// whatever price they wanted (see 0013_secure_order_pricing.sql). Pricing
// now happens entirely inside the place_order() RPC, recomputed server-side
// from `products`/`options`/`discounts` — the client only supplies WHAT was
// ordered (product + quantity + chosen variants), never what it costs.
export const createOrder = async ({ tableId, items, note, restaurantId, qrToken, paymentMethod, paymentMethodLabel }) => {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };

  const resolvedTableId = await resolveTableId(tableId, restaurantId);

  const rpcItems = (items || []).map((item) => ({
    product_id: item.product.id,
    quantity: item.quantity,
    note: item.note || '',
    // selectedOptions is {groupTitle: {name, extraPrice}} client-side; the
    // RPC only wants {groupTitle: choiceName} — it looks extraPrice back up
    // itself from the product's own options rather than trusting ours.
    selected_options: item.selectedOptions
      ? Object.fromEntries(
          Object.entries(item.selectedOptions).map(([group, choice]) => [group, choice?.name])
        )
      : {},
  }));

  const { data: orderId, error: rpcError } = await supabase.rpc('place_order', {
    p_restaurant_id: restaurantId,
    p_table_id: resolvedTableId,
    p_qr_token: qrToken,
    p_note: note || '',
    p_payment_method: paymentMethod || null,
    p_payment_method_label: paymentMethodLabel || null,
    p_items: rpcItems,
  });

  if (rpcError || !orderId) {
    console.error('createOrder error:', rpcError);
    return { order: null, error: rpcError || new Error('Order insertion failed') };
  }

  // fetchOrderById needs authenticated + is_staff_of() (same RLS gap as
  // fetchOrders — no anon SELECT policy on `orders` at all), so for the
  // anonymous customer session that calls createOrder in the first place,
  // this always comes back null even though the insert above genuinely
  // succeeded. `orderId` (already confirmed non-null) is returned alongside
  // so a caller has a real success signal that doesn't depend on this
  // best-effort staff-only lookup — see lib/store.js's createOrder, which
  // used to gate its post-order refetch on `order` being truthy and so
  // never refreshed for a customer at all.
  const order = await fetchOrderById(orderId);
  return { order, orderId, error: null };
};

export const updateOrderStatus = async (orderId, status) => {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*')
    .single();
  if (error) {
    console.error('updateOrderStatus error:', error);
    return { order: null, error };
  }
  const order = await fetchOrderById(data.id);
  return { order, error: null };
};

export const createAlert = async ({ tableId, type, paymentMethod, paymentMethodLabel, note, restaurantId, qrToken }) => {
  if (!supabaseReady) return { alert: null, error: new Error('Supabase not ready') };

  const resolvedTableId = await resolveTableId(tableId, restaurantId);

  // upsert_alert (see migration 0011) merges this into any existing ACTIVE
  // alert for the same table + type instead of always inserting a new row —
  // repeat waiter calls collapse into one bumped notification, and a bill
  // request whose payment method changes (cash -> card) updates the same
  // card instead of spawning a second one.
  const { data, error } = await supabase.rpc('upsert_alert', {
    p_table_id: resolvedTableId,
    p_restaurant_id: restaurantId,
    p_type: type,
    p_payment_method: paymentMethod || null,
    p_payment_method_label: paymentMethodLabel || null,
    p_note: note || null,
    p_qr_token: qrToken || null,
  });
  if (error) {
    console.error('createAlert error:', error);
    return { alert: null, error };
  }
  return { alert: normalizeAlert(data), error: null };
};

export const resolveAlert = async (alertId) => {
  if (!supabaseReady) return { alert: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase
    .from('alerts')
    .update({ status: 'resolved' })
    .eq('id', alertId)
    .select('*')
    .single();
  if (error) {
    console.error('resolveAlert error:', error);
    return { alert: null, error };
  }
  return { alert: normalizeAlert(data), error: null };
};

// EN/RU translations override (0029_product_category_translations.sql).
// Strips empty strings and empty per-locale objects so `{en: {name: ''}}`
// (an admin who typed then cleared a field) can never shadow the AZ
// fallback — getLocalizedProduct/getLocalizedCategoryName in
// lib/translations.js only treat a translation as present when it has a
// truthy name/description, but cleaning it here too means a saved row never
// carries dead placeholder keys for a future reader to trip over.
const cleanTranslations = (translations) => {
  if (!translations || typeof translations !== 'object') return {};
  const cleaned = {};
  for (const locale of ['en', 'ru']) {
    const entry = translations[locale];
    if (!entry || typeof entry !== 'object') continue;
    const trimmedEntry = {};
    if (typeof entry.name === 'string' && entry.name.trim()) trimmedEntry.name = entry.name.trim();
    if (typeof entry.description === 'string' && entry.description.trim()) trimmedEntry.description = entry.description.trim();
    if (Object.keys(trimmedEntry).length > 0) cleaned[locale] = trimmedEntry;
  }
  return cleaned;
};

// The Admin product form works in camelCase and calls the category FK
// `category`; some of its keys have no column at all (`currency`, plus
// anything inherited from the seed JSON shape such as calories/ingredients).
// PostgREST rejects the entire request on the first unknown key — that is
// exactly what made every product create/update fail with PGRST204 — so the
// row is built explicitly here rather than spreading the form object straight
// through. This also stops any future form field from breaking writes.
const toProductRow = (product) => {
  const row = {};
  if (product.name !== undefined) row.name = product.name;
  if (product.price !== undefined) row.price = product.price;
  if (product.description !== undefined) row.description = product.description;
  if (product.image !== undefined) row.image = product.image;
  if (product.options !== undefined) row.options = product.options;
  if (product.rating !== undefined) row.rating = product.rating;
  if (product.is_available !== undefined) row.is_available = product.is_available;

  if (product.category !== undefined) row.category_id = product.category || null;
  if (product.category_id !== undefined) row.category_id = product.category_id || null;

  // Without this line the admin's EN/RU form fields save silently and
  // nothing persists — the exact PGRST204/whitelist trap this function's
  // own header comment warns about, just in the opposite direction (an
  // omitted key here is a silent no-op, not a 400).
  if (product.translations !== undefined) row.translations = cleanTranslations(product.translations);

  if (product.isPopular !== undefined) row.is_popular = Boolean(product.isPopular);
  if (product.isChefChoice !== undefined) row.is_chef_choice = Boolean(product.isChefChoice);
  if (product.isSpicy !== undefined) row.is_spicy = Boolean(product.isSpicy);
  if (product.isVegetarian !== undefined) row.is_vegetarian = Boolean(product.isVegetarian);

  // Only the raw numeric field is ever written — never the formatted
  // `prepTime` display string, which would not fit an integer column. An
  // empty form field clears the value rather than writing 0.
  if (product.prepTimeMinutes !== undefined) {
    const raw = product.prepTimeMinutes;
    if (raw === null || raw === '') {
      row.prep_time_minutes = null;
    } else {
      const n = Number(raw);
      row.prep_time_minutes = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    }
  }

  // Nutrition (0031). Only the *Value fields are ever written — never the
  // formatted `calories`/`protein` display strings, which the numeric columns
  // would reject. An empty form field clears the value rather than writing 0,
  // so "not measured" stays distinguishable from "genuinely zero".
  const numericColumn = (raw, { integer = false } = {}) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return integer ? Math.round(n) : Math.round(n * 10) / 10;
  };

  if (product.caloriesValue !== undefined) row.calories = numericColumn(product.caloriesValue, { integer: true });
  if (product.proteinValue !== undefined) row.protein_g = numericColumn(product.proteinValue);
  if (product.carbsValue !== undefined) row.carbs_g = numericColumn(product.carbsValue);
  if (product.fatValue !== undefined) row.fat_g = numericColumn(product.fatValue);

  return row;
};

export const createProduct = async (product, restaurantId) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const payload = toProductRow(product);
  if (restaurantId) payload.restaurant_id = restaurantId;
  const { data, error } = await supabase.from('products').insert(payload).select('*').single();
  if (error) {
    console.error('createProduct error:', error);
    return { product: null, error };
  }
  return { product: normalizeProductRow(data), error: null };
};

export const updateProduct = async (product) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const { id } = product;
  // toProductRow only emits keys the caller actually supplied, so a PATCH from
  // the Admin form leaves columns it doesn't edit (rating, is_available)
  // untouched instead of nulling them.
  const payload = toProductRow(product);
  const { data, error } = await supabase.from('products').update(payload).eq('id', id).select('*').single();
  if (error) {
    console.error('updateProduct error:', error);
    return { product: null, error };
  }
  return { product: normalizeProductRow(data), error: null };
};

export const deleteProduct = async (productId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) {
    console.error('deleteProduct error:', error);
    return { error };
  }
  return { error: null };
};

// Same reasoning as toProductRow above: build the row explicitly instead of
// spreading the form object straight through. The Admin category form only
// ever sends {name, icon} today so this isn't live-broken, but products had
// the exact same "spread the form object" shape before an extra client-only
// field (currency) caused PGRST204 on every write (0017) — whitelisting here
// too means a future category field can't silently break every create/update.
const toCategoryRow = (category) => {
  const row = {};
  if (category.name !== undefined) row.name = category.name;
  if (category.icon !== undefined) row.icon = category.icon;
  // 0033_media_uploads.sql — the category's own photo, separate from the
  // emoji `icon` above (uploaded via lib/services/storageService.js or
  // pasted as an external URL, same as products.image).
  if (category.image !== undefined) row.image = category.image;
  if (category.sort_order !== undefined) row.sort_order = category.sort_order;
  // categories has no description column, so cleanTranslations naturally
  // only ever keeps the `name` field per locale here (see its own comment).
  if (category.translations !== undefined) row.translations = cleanTranslations(category.translations);
  return row;
};

export const createCategory = async (category, restaurantId) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const payload = toCategoryRow(category);
  if (restaurantId) payload.restaurant_id = restaurantId;
  const { data, error } = await supabase.from('categories').insert(payload).select('*').single();
  if (error) {
    console.error('createCategory error:', error);
    return { category: null, error };
  }
  return { category: normalizeCategory(data), error: null };
};

export const updateCategory = async (category) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const { id } = category;
  const payload = toCategoryRow(category);
  const { data, error } = await supabase.from('categories').update(payload).eq('id', id).select('*').single();
  if (error) {
    console.error('updateCategory error:', error);
    return { category: null, error };
  }
  return { category: normalizeCategory(data), error: null };
};

export const deleteCategory = async (categoryId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) {
    console.error('deleteCategory error:', error);
    return { error };
  }
  return { error: null };
};

export const updateTableName = async (tableId, name) => {
  if (!supabaseReady) return { table: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.from('restaurant_tables').update({ name }).eq('id', tableId).select(PUBLIC_TABLE_COLUMNS).single();
  if (error) {
    console.error('updateTableName error:', error);
    return { table: null, error };
  }
  return { table: normalizeTable(data), error: null };
};

const createRealtimeChannel = async (channelName, table, callback) => {
  if (!supabaseReady) return null;
  const channel = supabase.channel(channelName);
  await channel
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      callback(payload);
    })
    .subscribe();
  return channel;
};

export const subscribeToOrders = async (callback) => createRealtimeChannel('realtime-orders', 'orders', callback);
export const subscribeToAlerts = async (callback) => createRealtimeChannel('realtime-alerts', 'alerts', callback);
export const subscribeToProducts = async (callback) => createRealtimeChannel('realtime-products', 'products', callback);
export const subscribeToCategories = async (callback) => createRealtimeChannel('realtime-categories', 'categories', callback);
export const subscribeToTables = async (callback) => createRealtimeChannel('realtime-tables', 'restaurant_tables', callback);

export const unsubscribeRealtime = async (channel) => {
  if (!supabaseReady || !channel) return;
  await supabase.removeChannel(channel);
};
