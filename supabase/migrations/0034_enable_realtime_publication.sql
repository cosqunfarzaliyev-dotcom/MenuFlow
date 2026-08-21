-- Every surface (Customer, Staff, Admin) already calls the RealtimeManager's
-- subscribe*() helpers (lib/services/realtime.js), which open a Supabase
-- Realtime channel and listen for `postgres_changes` on orders/alerts/
-- products/categories/restaurant_tables. That code has always been correct,
-- but `postgres_changes` only fires for tables that are members of the
-- `supabase_realtime` publication -- and no prior migration ever added any
-- table to it, so every one of those subscriptions has silently been a
-- no-op: `channel.subscribe()` resolves successfully, no error is ever
-- thrown, but no event is ever delivered. The only way anyone ever saw
-- fresh data was a manual reload (which re-runs loadOrders()/loadAlerts()/
-- loadMenuData()/loadTables() from scratch).
--
-- order_items is included alongside orders even though nothing subscribes
-- to it directly today, since it's the same logical entity (per-line
-- payment status from settle_table_payment()) and costs nothing to enable
-- now rather than rediscovering this same gap later.
alter publication supabase_realtime add table
  public.orders,
  public.order_items,
  public.alerts,
  public.products,
  public.categories,
  public.restaurant_tables;
