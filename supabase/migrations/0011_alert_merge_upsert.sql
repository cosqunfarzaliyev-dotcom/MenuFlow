-- ============================================================================
-- MenuFlow — Merge repeat alerts from the same table into one notification
-- ============================================================================
-- Problem: every tap of "Garson" (waiter call) or "Hesab" (bill request)
-- inserted a brand-new row in `alerts`, so a table calling twice showed up
-- as two separate cards in the staff panel, and a customer who requested
-- the bill with "cash" then changed their mind to "card" created a second,
-- confusing card instead of updating the first one.
--
-- Fix: `upsert_alert()` looks for an existing ACTIVE alert for the same
-- table + type. If one exists it UPDATEs it in place (new payment method/
-- note, bumped `updated_at`, `call_count` incremented) instead of inserting
-- a duplicate. The staff panel then orders by `updated_at desc`, so the
-- most recently touched call always floats back to the top — whether that's
-- a brand-new call or a repeat/edited one.
--
-- Run this after 0010_order_payment_method.sql.
-- ============================================================================

alter table public.alerts add column if not exists updated_at timestamptz not null default now();
alter table public.alerts add column if not exists call_count int not null default 1;

-- Keep existing rows sane: treat their current created_at as the initial
-- updated_at so ordering by updated_at doesn't shuffle historical data.
update public.alerts set updated_at = created_at where updated_at is null;

create index if not exists alerts_status_updated_at_idx on public.alerts (status, updated_at desc);

create or replace function public.upsert_alert(
  p_table_id uuid,
  p_restaurant_id uuid,
  p_type text,
  p_payment_method text,
  p_payment_method_label text,
  p_note text,
  p_qr_token text
)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  result public.alerts;
begin
  -- Lock any existing active alert for this table + type so two rapid
  -- taps can't both slip through as separate inserts.
  select id into existing_id
  from public.alerts
  where table_id = p_table_id
    and type = p_type
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if existing_id is not null then
    update public.alerts
    set payment_method = coalesce(p_payment_method, payment_method),
        payment_method_label = coalesce(p_payment_method_label, payment_method_label),
        note = coalesce(p_note, note),
        qr_token = coalesce(p_qr_token, qr_token),
        call_count = call_count + 1,
        updated_at = now()
    where id = existing_id
    returning * into result;
  else
    insert into public.alerts (
      table_id, restaurant_id, type, payment_method, payment_method_label,
      note, status, qr_token, call_count, updated_at
    )
    values (
      p_table_id, p_restaurant_id, p_type, p_payment_method, p_payment_method_label,
      p_note, 'active', p_qr_token, 1, now()
    )
    returning * into result;
  end if;

  return result;
end;
$$;

grant execute on function public.upsert_alert(uuid, uuid, text, text, text, text, text) to anon, authenticated;
