import { supabase, supabaseReady } from '@/lib/supabase';

async function createOrder(order) {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };

  try {
    const orderPayload = {
      table_id: order.table_id ?? null,
      total: order.total ?? null,
      status: order.status ?? 'pending',
      payment_method: order.paymentMethod ?? null,
      payment_method_label: order.paymentMethodLabel ?? null,
      note: order.note ?? null,
    };

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('*')
      .single();

    if (orderError) return { order: null, error: orderError };

    const items = Array.isArray(order.items) ? order.items : [];

    if (items.length > 0) {
      const orderItems = items.map((it) => ({
        order_id: newOrder.id,
        product_id: it.product_id ?? null,
        name: it.name ?? null,
        price: it.price ?? null,
        quantity: it.quantity ?? 1,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) {
        // attempt best-effort cleanup of the partially created order
        try {
          await supabase.from('orders').delete().eq('id', newOrder.id);
        } catch (cleanupErr) {
          // ignore cleanup errors, surface original itemsError
        }
        return { order: null, error: itemsError };
      }
    }

    // return the full order with its items
    const { data: fullOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', newOrder.id)
      .single();

    return { order: fullOrder ?? newOrder, error: fetchErr };
  } catch (err) {
    return { order: null, error: err };
  }
}

async function updateOrderStatus(orderId, status) {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select('*')
      .single();

    return { order: data, error };
  } catch (err) {
    return { order: null, error: err };
  }
}

async function getOrders(opts = {}) {
  if (!supabaseReady) return { orders: [], error: new Error('Supabase not ready') };
  try {
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });

    if (opts.tableId) query = query.eq('table_id', opts.tableId);
    if (opts.status) query = query.eq('status', opts.status);

    const { data, error } = await query;
    return { orders: data ?? [], error };
  } catch (err) {
    return { orders: [], error: err };
  }
}

async function deleteOrder(orderId) {
  if (!supabaseReady) return { success: false, error: new Error('Supabase not ready') };
  try {
    // delete dependent items first (best-effort if FK cascade exists)
    const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', orderId);
    if (itemsError) return { success: false, error: itemsError };

    const { data, error } = await supabase.from('orders').delete().eq('id', orderId).select('*').single();
    if (error) return { success: false, error };
    return { success: true, order: data };
  } catch (err) {
    return { success: false, error: err };
  }
}

async function getOrder(orderId) {
  if (!supabaseReady) return { order: null, error: new Error('Supabase not ready') };
  try {
    const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single();
    return { order: data, error };
  } catch (err) {
    return { order: null, error: err };
  }
}

export { createOrder, updateOrderStatus, getOrders, deleteOrder, getOrder };
