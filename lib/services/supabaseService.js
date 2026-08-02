import { supabase, supabaseReady } from '@/lib/supabase';

const warnMissingClient = () => {
  if (!supabaseReady) {
    console.warn('Supabase client is not ready; skipping Supabase operation.');
  }
};

const isUuid = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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

const normalizeProductRow = (product) => {
  if (!product) return null;
  return {
    ...product,
    id: product.id?.toString(),
  };
};

export const fetchTables = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .order('table_number', { ascending: true });
  if (error) {
    console.error('fetchTables error:', error);
    return [];
  }
  return (data || []).map(normalizeTable);
};

export const fetchTableByNumber = async (tableNumber) => {
  if (!supabaseReady) return null;
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('table_number', Number(tableNumber))
    .single();
  if (error) {
    console.error('fetchTableByNumber error:', error);
    return null;
  }
  return normalizeTable(data);
};

export const fetchProducts = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.error('fetchProducts error:', error);
    return [];
  }
  return (data || []).map(normalizeProductRow);
};

export const fetchCategories = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
  if (error) {
    console.error('fetchCategories error:', error);
    return [];
  }
  return (data || []).map(normalizeCategory);
};

export const fetchOrders = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(`id, table_id, status, total, created_at, order_items(id, quantity, price, note, product:products(*)), restaurant_tables(table_number)`)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('fetchOrders error:', error);
    return [];
  }
  return (data || []).map(normalizeOrder);
};

export const fetchAlerts = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('alerts')
    .select('id, table_id, type, payment_method, payment_method_label, note, status, created_at, restaurant_tables(table_number)')
    .order('created_at', { ascending: true });
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

export const createOrder = async ({ tableId, total, items, note }) => {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };
  
  let resolvedTableId = tableId;
  if (tableId && !isUuid(tableId)) {
    const { data: dbTable } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('table_number', Number(tableId))
      .single();
    if (dbTable) {
      resolvedTableId = dbTable.id;
    }
  }

  const { data: insertedOrder, error: orderError } = await supabase
    .from('orders')
    .insert({ table_id: resolvedTableId, status: 'pending', total, note })
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

export const createAlert = async ({ tableId, type, paymentMethod, paymentMethodLabel, note }) => {
  if (!supabaseReady) return { alert: null, error: new Error('Supabase not ready') };
  
  let resolvedTableId = tableId;
  if (tableId && !isUuid(tableId)) {
    const { data: dbTable } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('table_number', Number(tableId))
      .single();
    if (dbTable) {
      resolvedTableId = dbTable.id;
    }
  }

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      table_id: resolvedTableId,
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

export const createProduct = async (product) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.from('products').insert(product).select('*').single();
  if (error) {
    console.error('createProduct error:', error);
    return { product: null, error };
  }
  return { product: normalizeProductRow(data), error: null };
};

export const updateProduct = async (product) => {
  if (!supabaseReady) return { product: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.from('products').update(product).eq('id', product.id).select('*').single();
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

export const createCategory = async (category) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.from('categories').insert(category).select('*').single();
  if (error) {
    console.error('createCategory error:', error);
    return { category: null, error };
  }
  return { category: normalizeCategory(data), error: null };
};

export const updateCategory = async (category) => {
  if (!supabaseReady) return { category: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.from('categories').update(category).eq('id', category.id).select('*').single();
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
