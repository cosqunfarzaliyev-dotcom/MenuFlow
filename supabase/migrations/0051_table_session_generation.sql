-- ============================================================================
-- MenuFlow — table session generation (server-side "new customer" signal)
-- ============================================================================
-- Customer-side background story: CustomerApp.jsx auto-locks the menu (shows
-- "Sessiya bitdi — rescan the QR") when the tab has been hidden 30s+ with no
-- active order, to stop a stale/abandoned menu screen sitting open on a
-- shared table device. The lock used to be released the moment the browser
-- reported a fresh top-level navigation — but that signal cannot tell "the
-- customer physically rescanned the QR sticker" apart from "the browser was
-- fully closed and reopened to the same link": both are, byte for byte, the
-- exact same HTTP request, because restaurant_tables.qr_token (0008) is a
-- fixed, deterministic value generated once per table and NEVER rotated —
-- and it must stay that way; the printed sticker on the table is permanent
-- and is explicitly not being touched by this migration.
--
-- Given the QR/token can carry no distinguishing signal, the only truthful
-- "a new customer's session has begun" signal left is a real-world staff
-- action: settling a table's bill (settle_table_payment(), 0025) is already
-- the checkpoint that marks a table's current dining party as done. This
-- migration adds a per-table counter that only that action advances, and
-- exposes it (read-only, alongside the other already-public table columns)
-- so the customer page can compare "the generation I was locked at" against
-- "the table's generation right now" — a comparison entirely independent of
-- sessionStorage/localStorage presence, tab identity, navigation type, or
-- browser lifecycle. Those remain unusable as proof of anything; this column
-- is the actual proof, and it only ever changes via a real staff action.
-- ============================================================================

alter table public.restaurant_tables
  add column if not exists session_generation integer not null default 1;

comment on column public.restaurant_tables.session_generation is
  'Bumped only by settle_table_payment(..., p_paid => true) — the one real-world checkpoint marking a table''s current party as done. CustomerApp.jsx compares this against the generation it was locked at to decide whether a persisted "session expired" lock still applies.';

-- Additive: PostgreSQL column-level grants accumulate per grantee, so this
-- does not disturb the existing (id, restaurant_id, table_number, name,
-- created_at) grant from 0008_qr_token_verification.sql — it only adds this
-- one column to what anon/authenticated may already select.
grant select (session_generation) on public.restaurant_tables to anon, authenticated;

-- Full CREATE OR REPLACE (function bodies aren't patchable) — identical to
-- the live definition except the one new update at the end of the p_paid
-- branch. Bumps regardless of how many order rows were actually flipped
-- (v_count could be 0, e.g. staff re-settling an already-paid table) — the
-- call itself represents staff deciding this table's session is over, which
-- is the signal, not the row count.
create or replace function public.settle_table_payment(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_payment_method text default null::text,
  p_payment_method_label text default null::text,
  p_paid boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count int := 0;
  v_total numeric := 0;
begin
  if p_restaurant_id is null or p_table_id is null then
    raise exception 'Restoran və masa tələb olunur.' using errcode = 'P0001';
  end if;

  if not public.is_staff_of(p_restaurant_id) then
    raise exception 'Bu əməliyyat üçün səlahiyyətiniz yoxdur.' using errcode = 'P0001';
  end if;

  if p_paid then
    update public.orders
    set payment_status = 'paid',
        paid_at = now(),
        paid_by = auth.uid(),
        payment_method = coalesce(p_payment_method, payment_method),
        payment_method_label = coalesce(p_payment_method_label, payment_method_label)
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and payment_status = 'unpaid'
      and status <> 'cancelled';
  else
    update public.orders
    set payment_status = 'unpaid',
        paid_at = null,
        paid_by = null
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and payment_status = 'paid'
      and status <> 'cancelled';
  end if;

  get diagnostics v_count = row_count;

  select coalesce(sum(total), 0) into v_total
  from public.orders
  where restaurant_id = p_restaurant_id
    and table_id = p_table_id
    and status <> 'cancelled'
    and payment_status = case when p_paid then 'paid' else 'unpaid' end;

  if p_paid then
    update public.alerts
    set status = 'resolved',
        updated_at = now()
    where restaurant_id = p_restaurant_id
      and table_id = p_table_id
      and type = 'bill'
      and status = 'active';

    -- The new-session checkpoint: settling the table's bill is the one
    -- real-world event that reliably means "this party is done." The next
    -- customer's QR scan (or, honestly, anyone's next page load) compares
    -- against this new value and unlocks — see CustomerApp.jsx.
    update public.restaurant_tables
    set session_generation = session_generation + 1
    where id = p_table_id
      and restaurant_id = p_restaurant_id;
  end if;

  return jsonb_build_object('settled_count', v_count, 'settled_total', v_total);
end;
$function$;
