-- ============================================================================
-- MenuFlow — SECURITY FIX: upsert_alert() bypassed QR token verification
-- ============================================================================
-- 0011_alert_merge_upsert.sql added upsert_alert() (SECURITY DEFINER, granted
-- to anon) to merge repeat waiter/bill calls into one row. It took p_qr_token
-- as a parameter but never actually checked it before inserting or updating.
--
-- Impact: SECURITY DEFINER functions run with the function owner's
-- privileges and bypass RLS on the tables they touch — the
-- alerts_public_insert policy's verify_qr_token() check (0008) is never
-- consulted here. Since the function is grant execute'd to anon, anyone with
-- the public anon key could call it directly with ANY restaurant_id/table_id
-- and any (or no) token — spoofing waiter/bill calls on a restaurant they've
-- never scanned a QR code for, completely undermining the signed-token
-- protection 0008 built. Worse, the UPDATE branch (merging into an existing
-- active alert) isn't covered by the alerts_rate_limit INSERT trigger either,
-- so once one alert exists it could be "bumped" at unlimited frequency.
--
-- Fix: verify the token the same way the original INSERT policy did, and add
-- a small per-row cooldown on the UPDATE/merge branch so a valid token can't
-- be used to bump-spam a single alert faster than a human would plausibly
-- call again.
--
-- Run this after 0011_alert_merge_upsert.sql.
-- ============================================================================

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
  existing_updated_at timestamptz;
  result public.alerts;
begin
  if p_table_id is null or p_restaurant_id is null
     or not public.verify_qr_token(p_restaurant_id, p_table_id, p_qr_token) then
    raise exception 'Etibarsız və ya köhnəlmiş QR link.' using errcode = 'P0001';
  end if;

  select id, updated_at into existing_id, existing_updated_at
  from public.alerts
  where table_id = p_table_id
    and type = p_type
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if existing_id is not null then
    -- Same 5-second-class cooldown the original INSERT rate limiter gave
    -- brand-new alerts — applied here too, since merge/bump updates aren't
    -- covered by that trigger (it only fires on INSERT).
    if existing_updated_at > now() - interval '5 seconds' then
      raise exception 'Çağırış artıq göndərilib. Bir neçə saniyə gözləyin.' using errcode = 'P0001';
    end if;

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
