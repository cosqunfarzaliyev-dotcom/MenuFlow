-- ============================================================================
-- MenuFlow — bind order_items INSERT to the same signed QR token as orders
-- ============================================================================
-- 0008_qr_token_verification.sql locked down `orders` and `alerts` INSERT
-- behind verify_qr_token(), but `order_items` was left as
-- `with check (true)` from 0001 — order_items has no restaurant_id/table_id
-- /qr_token columns of its own, it only carries order_id. That's the gap:
-- anyone with the anon key can still POST order_items rows straight to the
-- REST API pointing at ANY order_id (including another restaurant's order),
-- injecting fake line items into an order that already passed the token
-- check. The order-level fix didn't cover this because order_items was
-- never actually re-checked against 0008.
--
-- Fix: an order_items row is only insertable if it points at an order_id
-- whose own (restaurant_id, table_id, qr_token) still verifies. This piggy-
-- backs on the same secret/verify_qr_token() from 0008 — no new token type,
-- no client changes needed, since createOrder() already writes qr_token
-- onto the order row before inserting its items.
--
-- Run this after 0008_qr_token_verification.sql.
-- ============================================================================

drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert" on public.order_items for insert with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.verify_qr_token(o.restaurant_id, o.table_id, o.qr_token)
  )
);
