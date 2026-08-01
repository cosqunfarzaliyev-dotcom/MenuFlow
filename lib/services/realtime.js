import { supabase, supabaseReady } from '@/lib/supabase';

// Reusable helper to subscribe to postgres_changes for INSERT/UPDATE/DELETE on a table
async function subscribeTo(table, onEvent) {
  if (!supabaseReady) {
    console.warn('Supabase not ready — realtime subscription skipped for', table);
    return {
      unsubscribe: async () => {},
    };
  }

  const channelName = `realtime_${table}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const channel = supabase.channel(channelName);

  const handlePayload = (event, payload) => {
    // payload shape can vary between supabase-js versions: check common fields
    const record = payload?.new ?? payload?.record ?? payload?.data ?? payload;
    try {
      onEvent({ event, table, record, raw: payload });
    } catch (err) {
      // swallow handler errors to avoid breaking realtime channel
      // consumers should handle their own errors
      // eslint-disable-next-line no-console
      console.error('realtime handler error for', table, event, err);
    }
  };

  ['INSERT', 'UPDATE', 'DELETE'].forEach((evt) => {
    channel.on('postgres_changes', { event: evt, schema: 'public', table }, (payload) =>
      handlePayload(evt, payload)
    );
  });

  await channel.subscribe();

  return {
    channel,
    unsubscribe: async () => {
      try {
        await supabase.removeChannel(channel);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to remove realtime channel', channelName, err);
      }
    },
  };
}

// Specific table helpers
async function subscribeOrders(onEvent) {
  return subscribeTo('orders', onEvent);
}

async function subscribeProducts(onEvent) {
  return subscribeTo('products', onEvent);
}

async function subscribeCategories(onEvent) {
  return subscribeTo('categories', onEvent);
}

async function subscribeAlerts(onEvent) {
  return subscribeTo('alerts', onEvent);
}

async function subscribeTables(onEvent) {
  return subscribeTo('restaurant_tables', onEvent);
}

export { subscribeOrders, subscribeProducts, subscribeCategories, subscribeAlerts, subscribeTables, subscribeTo };
