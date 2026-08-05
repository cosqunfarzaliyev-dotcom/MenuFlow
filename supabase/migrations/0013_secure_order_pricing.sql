-- ============================================================================
-- MenuFlow — SECURITY FIX: server-side order pricing (place_order)
-- ============================================================================
-- Today createOrder() (lib/services/supabaseService.js) inserts straight into
-- `orders` and `order_items` from the browser, and BOTH order.total and every
-- order_items.price are values it received from client state:
--   price: item.price ?? item.product.price
--   total: <computed in CartDrawer.jsx from that same client state>
-- 0008/0009 lock down WHO can insert (must hold a valid signed QR token for
-- that restaurant/table) but never re-check WHAT is being inserted. A
-- technical customer can open devtools, edit the cart/product objects (or
-- just POST directly to PostgREST) before submitting, and set any price or
-- total they want — including 0 — while the kitchen still prepares and
-- serves the real items. Variant/add-on extraPrice (products.options) and
-- discounts (public.discounts, see 0006) are *also* only ever applied
-- client-side (components/CartDrawer.jsx, lib/services/promotionsService.js
-- applyDiscounts()), so the same gap lets a customer null those out too.
--
-- Fix: order/order_item pricing moves into a SECURITY DEFINER RPC,
-- place_order(), that recomputes every line price from the server's own
-- `products` row (+ that product's live `options` choices and any live
-- `discounts` row) — never from anything the client sent. The direct INSERT
-- policies on `orders`/`order_items` are dropped so this RPC becomes the
-- only way to create an order; the qr_token check those policies used to do
-- is re-checked inside the function instead (same verify_qr_token() from
-- 0008, same pattern 0012 used for upsert_alert). Existing SELECT policies,
-- the rate-limit trigger (0002), and the order_items token-binding intent
-- (0009) are all unaffected — this only changes how rows get created.
--
-- Run this after 0012_upsert_alert_token_fix.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Price one line item server-side: base product price, + any matching
--    variant/add-on extraPrice (looked up from products.options — never
--    trusted from the client), then the best live discount for that
--    product (mirrors applyDiscounts() in promotionsService.js: store-wide
--    or product-scoped, whichever saves the customer more, clamped at 0).
--    Not exposed to anon/authenticated directly — only called from inside
--    place_order() below.
-- ----------------------------------------------------------------------------
create or replace function public.price_order_item(
  p_restaurant_id uuid,
  p_product_id uuid,
  p_selected_options jsonb   -- {"<option group title>": "<choice name>", ...}
)
returns numeric
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_product record;
  v_price numeric;
  v_group text;
  v_choice_name text;
  v_choice jsonb;
  v_extra numeric;
  v_best numeric;
  v_discounted numeric;
  d record;
begin
  select id, price, options into v_product
  from public.products
  where id = p_product_id and restaurant_id = p_restaurant_id;

  if not found then
    raise exception 'Etibarsız məhsul.' using errcode = 'P0001';
  end if;

  v_price := coalesce(v_product.price, 0);

  -- Variant/add-on extras: only ever added if that exact group+choice
  -- exists on THIS product's own options right now — a client can send any
  -- selected_options it likes, but the extraPrice always comes from the
  -- server row, so it can't be inflated, and an unknown/stale selection
  -- just contributes nothing rather than erroring out an otherwise valid
  -- order (product options can change between page load and checkout).
  if p_selected_options is not null then
    for v_group, v_choice_name in select * from jsonb_each_text(p_selected_options)
    loop
      select choice into v_choice
      from jsonb_array_elements(coalesce(v_product.options, '[]'::jsonb)) as grp,
           jsonb_array_elements(coalesce(grp->'choices', '[]'::jsonb)) as choice
      where grp->>'title' = v_group
        and choice->>'name' = v_choice_name
      limit 1;

      if v_choice is not null then
        v_extra := coalesce((v_choice->>'extraPrice')::numeric, 0);
        v_price := v_price + v_extra;
      end if;
    end loop;
  end if;

  -- Best live discount (store-wide product_id is null, or scoped to this
  -- product), same "biggest saving wins" rule as applyDiscounts().
  v_best := v_price;
  for d in
    select discount_type, value
    from public.discounts
    where restaurant_id = p_restaurant_id
      and is_active = true
      and (product_id is null or product_id = p_product_id)
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
  loop
    v_discounted := case
      when d.discount_type = 'percentage' then v_price - (v_price * d.value / 100)
      else v_price - d.value
    end;
    v_discounted := greatest(0, v_discounted);
    if v_discounted < v_best then
      v_best := v_discounted;
    end if;
  end loop;

  return round(v_best, 2);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Create an order + its items in one transaction, pricing every line
--    server-side. p_items is [{ "product_id", "quantity", "note",
--    "selected_options" }, ...] — quantity is the only numeric field
--    trusted from the client; every price is computed above.
-- ----------------------------------------------------------------------------
create or replace function public.place_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_qr_token text,
  p_note text,
  p_payment_method text,
  p_payment_method_label text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_note text;
  v_unit_price numeric;
begin
  if p_table_id is null or p_restaurant_id is null
     or not public.verify_qr_token(p_restaurant_id, p_table_id, p_qr_token) then
    raise exception 'Etibarsız və ya köhnəlmiş QR link.' using errcode = 'P0001';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sifariş boşdur.' using errcode = 'P0001';
  end if;

  insert into public.orders (
    table_id, restaurant_id, status, total, note, qr_token,
    payment_method, payment_method_label
  )
  values (
    p_table_id, p_restaurant_id, 'pending', 0, p_note, p_qr_token,
    p_payment_method, p_payment_method_label
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := coalesce((v_item->>'quantity')::int, 0);
    v_note := coalesce(v_item->>'note', '');

    if v_product_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 50 then
      raise exception 'Etibarsız sifariş sətri.' using errcode = 'P0001';
    end if;

    v_unit_price := public.price_order_item(p_restaurant_id, v_product_id, v_item->'selected_options');

    insert into public.order_items (order_id, product_id, quantity, price, note)
    values (v_order_id, v_product_id, v_quantity, v_unit_price, v_note);

    v_total := v_total + round(v_unit_price * v_quantity, 2);
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.place_order(uuid, uuid, text, text, text, text, jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. place_order() is now the only supported way to create an order: drop
--    the direct client INSERT policies from 0008/0009 so `total` and
--    `price` can no longer be posted straight from the browser. All other
--    policies (SELECT for staff, UPDATE for status changes, etc.) are
--    untouched.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "order_items_public_insert" on public.order_items;

-- ----------------------------------------------------------------------------
-- POST-MIGRATION: update the client to call place_order() instead of
-- inserting into orders/order_items directly (see accompanying change to
-- lib/services/supabaseService.js createOrder()). Until that ships, order
-- submission from the customer app will fail closed (no policy = no
-- insert) rather than silently accept client-supplied prices again.
-- ============================================================================
