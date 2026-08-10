-- ============================================================================
-- MenuFlow — Schema reconciliation: orders.note + product display fields
-- ============================================================================
-- Two P0 defects, both confirmed against a real (empty) database by the
-- backend smoke test:
--
-- 1. place_order() (0013_secure_order_pricing.sql) inserts into
--    public.orders (..., note, ...), but no migration ever added that column.
--    Every order submission failed with 42703 "column \"note\" of relation
--    \"orders\" does not exist" — placing an order has been impossible since
--    0013 shipped. The customer app really does collect an order-level note
--    ("Ümumi masa qeydi (Ofisiant üçün)", CartDrawer.jsx) and passes it
--    through store.createOrder -> p_note, so adding the column is the fix;
--    dropping the reference would silently discard what the customer typed.
--
--    The two note fields are deliberately distinct and both are kept:
--      orders.note      -> one general note for the whole order / the waiter
--      order_items.note -> a per-product kitchen request (already existed)
--
-- 2. The Admin product form (components/AdminApp.jsx) writes four badge
--    booleans that have no column, so every product create/update failed with
--    PGRST204. Those badges have a full admin UI (checkboxes) *and* customer
--    rendering (ProductCard / ProductDetailModal) — they are part of the
--    intended product model and were simply never persisted.
--
-- prep_time_minutes rides along because preparation time is part of the
-- product model and the customer UI already renders it. Storing one numeric
-- value in minutes (rather than free text like '12-15 dəq') keeps it usable
-- for later ETA/kitchen-sorting work without a second migration. It stays
-- nullable — the customer UI hides the field when it is not set.
--
-- Deliberately NOT added — each would duplicate an existing source of truth,
-- or has no admin input and no requirement yet:
--   products.category    -> category_id is already the FK; the frontend's
--                           `category` name is mapped in
--                           lib/services/supabaseService.js instead
--   products.currency    -> restaurants.currency_symbol already owns this
--   products.calories    -> seed-data-only (data/menu.json), deferred
--   products.ingredients -> seed-data-only (data/menu.json), deferred
--
-- Additive and idempotent: every new column is nullable or has a default, so
-- this is safe on the current empty database and on one with rows. No RLS or
-- grant changes — `orders` and `products` use table-level grants, which new
-- columns inherit automatically (unlike restaurant_tables, which has
-- column-level grants from 0008 and is untouched here).
--
-- Run this after 0016_restaurant_feature_flags.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. orders.note — the order-level note place_order() already tries to write
-- ----------------------------------------------------------------------------
alter table public.orders add column if not exists note text default '';

comment on column public.orders.note is
  'General note for the whole order (waiter-facing). Per-product kitchen requests live in order_items.note.';

-- ----------------------------------------------------------------------------
-- 2. products — badge flags the Admin panel already edits and the customer
--    menu already renders
-- ----------------------------------------------------------------------------
alter table public.products add column if not exists is_popular     boolean not null default false;
alter table public.products add column if not exists is_chef_choice boolean not null default false;
alter table public.products add column if not exists is_spicy       boolean not null default false;
alter table public.products add column if not exists is_vegetarian  boolean not null default false;

-- ----------------------------------------------------------------------------
-- 3. products.prep_time_minutes — single numeric preparation time, in minutes.
--    Same inline-check style as products.rating (0004_product_rating.sql).
-- ----------------------------------------------------------------------------
alter table public.products add column if not exists prep_time_minutes integer
  check (prep_time_minutes is null or prep_time_minutes >= 0);

comment on column public.products.prep_time_minutes is
  'Preparation time in whole minutes. Nullable — the customer UI hides the field when unset.';
