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
    time: alert.created_at || alert.time || new Date().toISOString(),
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
    .select(`id, table_id, status, total, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
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
    .select('id, table_id, type, payment_method, payment_method_label, note, status, created_at, restaurant_tables(table_number)')
    .order('created_at', { ascending: true });
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
    .select(`id, table_id, status, total, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
    .eq('id', orderId)
    .single();
  if (error) {
    console.error('fetchOrderById error:', error);
    return null;
  }
  return normalizeOrder(data);
};

export const createOrder = async ({ tableId, total, items, note, restaurantId }) => {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };

  const resolvedTableId = await resolveTableId(tableId, restaurantId);

  const { data: insertedOrder, error: orderError } = await supabase
    .from('orders')
    .insert({ table_id: resolvedTableId, restaurant_id: restaurantId, status: 'pending', total, note })
    .select('*')
    .single();

  if (orderError || !insertedOrder) {
    console.error('createOrder error:', orderError);
    return { order: null, error: orderError || new Error('Order insertion failed') };
  }

  if (items && items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: insertedOrder.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.price ?? item.product.price,
      note: item.note || '',
    }));

    const { error: itemError } = await supabase.from('order_items').insert(orderItems);
    if (itemError) {
      console.error('createOrder order_items error:', itemError);
      return { order: null, error: itemError };
    }
  }

  const order = await fetchOrderById(insertedOrder.id);
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

export const createAlert = async ({ tableId, type, paymentMethod, paymentMethodLabel, note, restaurantId }) => {
  if (!supabaseReady) return { alert: null, error: new Error('Supabase not ready') };

  const resolvedTableId = await resolveTableId(tableId, restaurantId);

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      table_id: resolvedTableId,
      restaurant_id: restaurantId,
      type,
      payment_method: paymentMethod,
      payment_method_label: paymentMethodLabel,
      note,
      status: 'active',
    })
    .select('*')
    .single();
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
