-- ============================================================================
-- MenuFlow — Restaurant-level rate limiting for orders and alerts
-- ============================================================================
-- Run this after 0002_security_hardening.sql and 0014_slug_server_side_validation.sql.
-- ============================================================================

create or replace function public.enforce_order_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_table_count int;
  hourly_table_count int;
  recent_restaurant_count int;
  hourly_restaurant_count int;
begin
  -- No more than 1 new order from the same table within 10 seconds.
  select count(*) into recent_table_count
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '10 seconds';

  if recent_table_count > 0 then
    raise exception 'Çox tez-tez sifariş göndərilir. Bir neçə saniyə gözləyin.' using errcode = 'P0001';
  end if;

  -- Hard cap: no more than 40 orders from the same table in an hour.
  select count(*) into hourly_table_count
  from public.orders
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';

  if hourly_table_count >= 40 then
    raise exception 'Bu masa üçün saatlıq sifariş limiti aşılıb.' using errcode = 'P0001';
  end if;

  -- Restaurant-wide safety valve: if a bot or script spreads across many
  -- tables, the whole restaurant is limited to 500 orders/hour.
  select count(*) into recent_restaurant_count
  from public.orders
  where restaurant_id = new.restaurant_id
    and created_at > now() - interval '10 seconds';

  if recent_restaurant_count > 0 and recent_restaurant_count >= 500 then
    raise exception 'Restoran üçün saatlıq sifariş limiti aşılıb.' using errcode = 'P0001';
  end if;

  select count(*) into hourly_restaurant_count
  from public.orders
  where restaurant_id = new.restaurant_id
    and created_at > now() - interval '1 hour';

  if hourly_restaurant_count >= 500 then
    raise exception 'Restoran üçün saatlıq sifariş limiti aşılıb.' using errcode = 'P0001';
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
  recent_table_count int;
  hourly_table_count int;
  recent_restaurant_count int;
  hourly_restaurant_count int;
begin
  -- No more than 1 new alert from the same table within 15 seconds.
  select count(*) into recent_table_count
  from public.alerts
  where table_id = new.table_id
    and created_at > now() - interval '15 seconds';

  if recent_table_count > 0 then
    raise exception 'Çağırış artıq göndərilib. Bir neçə saniyə gözləyin.' using errcode = 'P0001';
  end if;

  select count(*) into hourly_table_count
  from public.alerts
  where table_id = new.table_id
    and created_at > now() - interval '1 hour';

  if hourly_table_count >= 30 then
    raise exception 'Bu masa üçün saatlıq çağırış limiti aşılıb.' using errcode = 'P0001';
  end if;

  -- Restaurant-wide safety valve for waiter-call spam.
  select count(*) into recent_restaurant_count
  from public.alerts
  where restaurant_id = new.restaurant_id
    and created_at > now() - interval '15 seconds';

  if recent_restaurant_count > 0 and recent_restaurant_count >= 500 then
    raise exception 'Restoran üçün saatlıq çağırış limiti aşılıb.' using errcode = 'P0001';
  end if;

  select count(*) into hourly_restaurant_count
  from public.alerts
  where restaurant_id = new.restaurant_id
    and created_at > now() - interval '1 hour';

  if hourly_restaurant_count >= 500 then
    raise exception 'Restoran üçün saatlıq çağırış limiti aşılıb.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists alerts_rate_limit on public.alerts;
create trigger alerts_rate_limit
  before insert on public.alerts
  for each row execute procedure public.enforce_alert_rate_limit();

create index if not exists orders_table_id_created_at_idx on public.orders (table_id, created_at desc);
create index if not exists alerts_table_id_created_at_idx on public.alerts (table_id, created_at desc);
create index if not exists orders_restaurant_id_created_at_idx on public.orders (restaurant_id, created_at desc);
create index if not exists alerts_restaurant_id_created_at_idx on public.alerts (restaurant_id, created_at desc);
