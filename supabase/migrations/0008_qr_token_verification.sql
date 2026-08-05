-- ============================================================================
-- MenuFlow — Signed QR tokens (anon order/alert spoof protection)
-- ============================================================================

create extension if not exists pgcrypto schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Server-only secret
-- ----------------------------------------------------------------------------
create table if not exists public.app_secrets (
  id boolean primary key default true check (id),
  qr_signing_key text not null default encode(gen_random_bytes(32), 'hex')
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (id) values (true) on conflict (id) do nothing;
revoke all on public.app_secrets from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Token generation / verification.
-- ----------------------------------------------------------------------------
create or replace function public.generate_qr_token(p_restaurant_id uuid, p_table_id uuid)
returns text
language sql
security definer
set search_path = public, extensions
stable
as $$
  select encode(
    extensions.hmac(
      (p_restaurant_id::text || ':' || p_table_id::text)::bytea,
      (select qr_signing_key from public.app_secrets limit 1)::bytea,
      'sha256'::text
    ),
    'hex'
  );
$$;
revoke execute on function public.generate_qr_token(uuid, uuid) from anon, authenticated, public;

create or replace function public.verify_qr_token(p_restaurant_id uuid, p_table_id uuid, p_token text)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select p_token is not null
    and p_token = public.generate_qr_token(p_restaurant_id, p_table_id);
$$;
grant execute on function public.verify_qr_token(uuid, uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Tables carry their own signed token
-- ----------------------------------------------------------------------------
alter table public.restaurant_tables add column if not exists qr_token text;

create or replace function public.set_table_qr_token()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  new.qr_token := public.generate_qr_token(new.restaurant_id, new.id);
  return new;
end;
$$;

drop trigger if exists restaurant_tables_set_qr_token on public.restaurant_tables;
create trigger restaurant_tables_set_qr_token
  before insert on public.restaurant_tables
  for each row execute procedure public.set_table_qr_token();

-- Backfill existing tables
update public.restaurant_tables
set qr_token = public.generate_qr_token(restaurant_id, id)
where qr_token is null;

revoke select on public.restaurant_tables from anon, authenticated;
grant select (id, restaurant_id, table_number, name, created_at) on public.restaurant_tables to anon, authenticated;
grant insert, update, delete on public.restaurant_tables to authenticated;

create or replace function public.get_restaurant_qr_tokens(p_restaurant_id uuid)
returns table (id uuid, table_number int, name text, qr_token text)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select t.id, t.table_number, t.name, t.qr_token
  from public.restaurant_tables t
  where t.restaurant_id = p_restaurant_id
    and public.is_staff_of(p_restaurant_id);
$$;
grant execute on function public.get_restaurant_qr_tokens(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Orders / alerts policies
-- ----------------------------------------------------------------------------
alter table public.orders add column if not exists qr_token text;
alter table public.alerts add column if not exists qr_token text;

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders for insert with check (
  table_id is not null
  and restaurant_id is not null
  and public.verify_qr_token(restaurant_id, table_id, qr_token)
);

drop policy if exists "alerts_public_insert" on public.alerts;
create policy "alerts_public_insert" on public.alerts for insert with check (
  table_id is not null
  and restaurant_id is not null
  and public.verify_qr_token(restaurant_id, table_id, qr_token)
);