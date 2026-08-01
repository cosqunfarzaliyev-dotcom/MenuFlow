import { supabase, supabaseReady } from '@/lib/supabase';

const STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

class RealtimeManager {
  constructor() {
    this.channels = new Map(); // table -> { channel, handlers: Set<fn>, subscribed: bool, retryCount }
    this.status = STATUS.DISCONNECTED;
    this.statusListeners = new Set();
    this.backoffBase = 1000; // ms
    this.backoffMax = 30000; // ms

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline);
      window.addEventListener('offline', this._handleOffline);
    }
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((cb) => {
      try { cb(status); } catch (e) { /* ignore */ }
    });
  }

  addStatusListener(cb) { this.statusListeners.add(cb); }
  removeStatusListener(cb) { this.statusListeners.delete(cb); }
  getStatus() { return this.status; }

  _handleOnline = () => {
    // attempt immediate resubscribe for all tables
    this._connectAll();
  }

  _handleOffline = () => {
    this._setStatus(STATUS.DISCONNECTED);
  }

  async subscribe(table, handler) {
    if (!supabaseReady) {
      throw new Error('Supabase client not ready');
    }

    const key = table;
    let entry = this.channels.get(key);
    if (!entry) {
      entry = { channel: null, handlers: new Set(), subscribed: false, retryCount: 0, pending: false };
      this.channels.set(key, entry);
    }

    // prevent duplicate handler registration
    if (entry.handlers.has(handler)) {
      return { unsubscribe: async () => this.unsubscribe(table, handler) };
    }

    entry.handlers.add(handler);

    // if already subscribed, just return
    if (entry.subscribed) {
      return { unsubscribe: async () => this.unsubscribe(table, handler) };
    }

    // start subscription flow
    this._subscribeTable(key).catch((err) => {
      // swallow here, errors handled in _subscribeTable
      // eslint-disable-next-line no-console
      console.warn('subscribe error', err);
    });

    return { unsubscribe: async () => this.unsubscribe(table, handler) };
  }

  async _subscribeTable(key) {
    const entry = this.channels.get(key);
    if (!entry) return;
    if (entry.pending || entry.subscribed) return;
    entry.pending = true;

    try {
      this._setStatus(STATUS.CONNECTING);

      const channelName = `realtime_${key}`;
      const channel = supabase.channel(channelName);

      const handlePayload = (event) => (payload) => {
        const record = payload?.new ?? payload?.record ?? payload?.data ?? payload;
        // dispatch to handlers
        entry.handlers.forEach((h) => {
          try { h({ event, table: key, record, raw: payload }); } catch (e) { /* handler errors ignored */ }
        });
      };

      ['INSERT', 'UPDATE', 'DELETE'].forEach((evt) => {
        channel.on('postgres_changes', { event: evt, schema: 'public', table: key }, handlePayload(evt));
      });

      const { error } = await channel.subscribe();
      if (error) throw error;

      entry.channel = channel;
      entry.subscribed = true;
      entry.retryCount = 0;
      entry.pending = false;
      this._setStatus(STATUS.CONNECTED);
    } catch (err) {
      entry.pending = false;
      entry.subscribed = false;
      entry.retryCount = (entry.retryCount || 0) + 1;
      this._setStatus(STATUS.RECONNECTING);
      const delay = Math.min(this.backoffBase * 2 ** (entry.retryCount - 1), this.backoffMax);
      setTimeout(() => this._subscribeTable(key), delay);
    }
  }

  async unsubscribe(table, handler) {
    const key = table;
    const entry = this.channels.get(key);
    if (!entry) return;

    if (handler && entry.handlers.has(handler)) {
      entry.handlers.delete(handler);
    }

    if (entry.handlers.size === 0) {
      // fully unsubscribe channel
      if (entry.channel) {
        try {
          await supabase.removeChannel(entry.channel);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Failed to remove channel', key, err);
        }
      }
      this.channels.delete(key);
    }

    // update status
    if (this.channels.size === 0) this._setStatus(STATUS.DISCONNECTED);
  }

  async _connectAll() {
    for (const key of this.channels.keys()) {
      const entry = this.channels.get(key);
      if (entry && !entry.subscribed && !entry.pending) {
        this._subscribeTable(key);
      }
    }
  }

  // convenience helpers
  async subscribeOrders(handler) { return this.subscribe('orders', handler); }
  async subscribeProducts(handler) { return this.subscribe('products', handler); }
  async subscribeCategories(handler) { return this.subscribe('categories', handler); }
  async subscribeAlerts(handler) { return this.subscribe('alerts', handler); }
  async subscribeTables(handler) { return this.subscribe('restaurant_tables', handler); }
}

const manager = new RealtimeManager();

export const subscribeTo = (table, handler) => manager.subscribe(table, handler);
export const subscribeOrders = (handler) => manager.subscribeOrders(handler);
export const subscribeProducts = (handler) => manager.subscribeProducts(handler);
export const subscribeCategories = (handler) => manager.subscribeCategories(handler);
export const subscribeAlerts = (handler) => manager.subscribeAlerts(handler);
export const subscribeTables = (handler) => manager.subscribeTables(handler);
export const addRealtimeStatusListener = (cb) => manager.addStatusListener(cb);
export const removeRealtimeStatusListener = (cb) => manager.removeStatusListener(cb);
export const getRealtimeStatus = () => manager.getStatus();

export { STATUS };
