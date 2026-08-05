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

const normalizeProduct = (product) => {
  if (!product) return null;
  return {
    ...product,
    id: product.id?.toString(),
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
    paymentMethod: order.payment_method || order.paymentMethod,
    paymentMethodLabel: order.payment_method_label || order.paymentMethodLabel,
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

export const fetchTables = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });
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
  let query = supabase.from('restaurant_tables').select('*').eq('table_number', Number(tableNumber));
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
    .select(`id, table_id, status, total, payment_method, payment_method_label, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
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
    .select(`id, table_id, status, total, payment_method, payment_method_label, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
    .eq('id', orderId)
    .single();
  if (error) {
    console.error('fetchOrderById error:', error);
    return null;
  }
  return normalizeOrder(data);
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

  const order = await fetchOrderById(orderId);
  return { order, error: null };
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

export const createProduct = async (product, restaurantId) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const payload = restaurantId ? { ...product, restaurant_id: restaurantId } : product;
  const { data, error } = await supabase.from('products').insert(payload).select('*').single();
  if (error) {
    console.error('createProduct error:', error);
    return { product: null, error };
  }
  return { product: normalizeProductRow(data), error: null };
};

export const updateProduct = async (product) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = product;
  const { data, error } = await supabase.from('products').update(rest).eq('id', id).select('*').single();
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

export const createCategory = async (category, restaurantId) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const payload = restaurantId ? { ...category, restaurant_id: restaurantId } : category;
  const { data, error } = await supabase.from('categories').insert(payload).select('*').single();
  if (error) {
    console.error('createCategory error:', error);
    return { category: null, error };
  }
  return { category: normalizeCategory(data), error: null };
};

export const updateCategory = async (category) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = category;
  const { data, error } = await supabase.from('categories').update(rest).eq('id', id).select('*').single();
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
  const { data, error } = await supabase.from('restaurant_tables').update({ name }).eq('id', tableId).select('*').single();
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
