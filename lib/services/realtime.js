import { supabase, supabaseReady } from '@/lib/supabase';

const STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
};

class RealtimeManager {
  constructor() {
    this.channels = new Map(); // subscriptionKey -> { table, restaurantId, channel, handlers: Set<fn>, subscribed: bool, retryCount }
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

  _buildSubscriptionKey(table, restaurantId) {
    return `${table}:${restaurantId || 'all'}`;
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

  async subscribe(table, handler, options = {}) {
    if (!supabaseReady) {
      throw new Error('Supabase client not ready');
    }

    const { restaurantId } = options;
    const key = this._buildSubscriptionKey(table, restaurantId);
    let entry = this.channels.get(key);
    if (!entry) {
      entry = { table, restaurantId: restaurantId || null, channel: null, handlers: new Set(), subscribed: false, retryCount: 0, pending: false };
      this.channels.set(key, entry);
    }

    // prevent duplicate handler registration
    if (entry.handlers.has(handler)) {
      return { unsubscribe: async () => this.unsubscribe(table, handler, options) };
    }

    entry.handlers.add(handler);

    // if already subscribed, just return
    if (entry.subscribed) {
      return { unsubscribe: async () => this.unsubscribe(table, handler, options) };
    }

    // start subscription flow
    this._subscribeTable(key).catch((err) => {
      // swallow here, errors handled in _subscribeTable
      console.warn('subscribe error', err);
    });

    return { unsubscribe: async () => this.unsubscribe(table, handler, options) };
  }

  async _subscribeTable(key) {
    const entry = this.channels.get(key);
    if (!entry) return;
    if (entry.pending || entry.subscribed) return;
    entry.pending = true;

    try {
      this._setStatus(STATUS.CONNECTING);

      const channelName = `realtime_${entry.table}_${entry.restaurantId || 'all'}`;
      const channel = supabase.channel(channelName);

      const handlePayload = (event) => (payload) => {
        const record = payload?.new ?? payload?.record ?? payload?.data ?? payload;
        // dispatch to handlers
        entry.handlers.forEach((h) => {
          try { h({ event, table: entry.table, record, raw: payload }); } catch (e) { /* handler errors ignored */ }
        });
      };

      ['INSERT', 'UPDATE', 'DELETE'].forEach((evt) => {
        const postgresOptions = { event: evt, schema: 'public', table: entry.table };
        if (entry.restaurantId) {
          postgresOptions.filter = `restaurant_id=eq.${entry.restaurantId}`;
        }
        channel.on('postgres_changes', postgresOptions, handlePayload(evt));
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

  async unsubscribe(table, handler, options = {}) {
    const { restaurantId } = options;
    const key = this._buildSubscriptionKey(table, restaurantId);
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
  async subscribeOrders(handler, options) { return this.subscribe('orders', handler, options); }
  async subscribeProducts(handler, options) { return this.subscribe('products', handler, options); }
  async subscribeCategories(handler, options) { return this.subscribe('categories', handler, options); }
  async subscribeBanners(handler, options) { return this.subscribe('banners', handler, options); }
  async subscribeDiscounts(handler, options) { return this.subscribe('discounts', handler, options); }
  async subscribeAlerts(handler, options) { return this.subscribe('alerts', handler, options); }
  async subscribeTables(handler, options) { return this.subscribe('restaurant_tables', handler, options); }
  // Platform announcements are NOT restaurant-scoped (a broadcast row has no
  // restaurant_id at all), so unlike every method above this one deliberately
  // passes no restaurantId filter. RLS still decides what each subscriber is
  // allowed to receive.
  async subscribeAnnouncements(handler) { return this.subscribe('announcements', handler); }
}

const manager = new RealtimeManager();

export const subscribeTo = (table, handler, options) => manager.subscribe(table, handler, options);
export const subscribeOrders = (handler, options) => manager.subscribeOrders(handler, options);
export const subscribeProducts = (handler, options) => manager.subscribeProducts(handler, options);
export const subscribeCategories = (handler, options) => manager.subscribeCategories(handler, options);
export const subscribeBanners = (handler, options) => manager.subscribeBanners(handler, options);
export const subscribeDiscounts = (handler, options) => manager.subscribeDiscounts(handler, options);
export const subscribeAlerts = (handler, options) => manager.subscribeAlerts(handler, options);
export const subscribeTables = (handler, options) => manager.subscribeTables(handler, options);
export const subscribeAnnouncements = (handler) => manager.subscribeAnnouncements(handler);
export const addRealtimeStatusListener = (cb) => manager.addStatusListener(cb);
export const removeRealtimeStatusListener = (cb) => manager.removeStatusListener(cb);
export const getRealtimeStatus = () => manager.getStatus();

export { STATUS };
