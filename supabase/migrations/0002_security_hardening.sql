-- ============================================================================
-- MenuFlow — Security hardening
-- ============================================================================
-- orders/alerts INSERT is intentionally open to anyone (customers order
-- without logging in), which means it's also open to abuse — a script
-- hammering the endpoint from one table's QR link, or from a stolen link.
-- Since there's no server between the browser and Supabase to rate-limit
-- at, the limit has to live in the database itself: a BEFORE INSERT trigger
-- that rejects a burst of inserts for the same table faster than a human
-- placing/calling could plausibly generate them.
--
-- Run this after 0001_multi_tenant_saas.sql.
-- ============================================================================

create or replace function public.enforce_order_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  hourly_count int;
begin
  -- No more than 1 new order from the same table within 10 seconds
  -- (catches double-submits / scripted bursts, not real customers).
  select count(*) into recent_count
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '10 seconds';

  if recent_count > 0 then
    raise exception 'Çox tez-tez sifariş göndərilir. Bir neçə saniyə gözləyin.' using errcode = 'P0001';
  end if;

  -- Hard cap: no more than 40 orders from the same table in an hour.
  -- A busy table legitimately orders repeatedly through a meal, but this
  -- catches a runaway script hitting the same table_id.
  select count(*) into hourly_count
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';

  if hourly_count >= 40 then
    raise exception 'Bu masa üçün saatlıq sifariş limiti aşılıb.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_rate_limit on public.orders;
create trigger orders_rate_limit
  before insert on public.orders
  for each row execute procedure public.enforce_order_rate_limit();

create or replace function public.enforce_alert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  hourly_count int;
begin
  -- No more than 1 new alert (waiter call / bill request) from the same
  -- table within 15 seconds.
  select count(*) into recent_count
  from public.alerts
  where table_id = new.table_id
    and created_at > now() - interval '15 seconds';

  if recent_count > 0 then
    raise exception 'Çağırış artıq göndərilib. Bir neçə saniyə gözləyin.' using errcode = 'P0001';
  end if;

  select count(*) into hourly_count
  from public.alerts
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';

  if hourly_count >= 30 then
    raise exception 'Bu masa üçün saatlıq çağırış limiti aşılıb.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists alerts_rate_limit on public.alerts;
create trigger alerts_rate_limit
  before insert on public.alerts
  for each row execute procedure public.enforce_alert_rate_limit();

-- Indexes to keep the rate-limit lookups (and the earlier stats queries)
-- fast as order/alert volume grows.
create index if not exists orders_table_id_created_at_idx on public.orders (table_id, created_at desc);
create index if not exists alerts_table_id_created_at_idx on public.alerts (table_id, created_at desc);
