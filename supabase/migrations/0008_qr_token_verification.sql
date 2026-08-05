-- ============================================================================
-- MenuFlow — Signed QR tokens (anon order/alert spoof protection)
-- ============================================================================
-- Today, orders/alerts INSERT is open to anyone (`with check (true)`) so a
-- customer can order without logging in — but that also means anyone with
-- the public anon key can POST directly to the REST API with ANY
-- restaurant_id/table_id combination: fake orders on a competitor's table,
-- or a script hammering one restaurant nonstop. 0002_security_hardening.sql's
-- rate limiter slows that down but doesn't stop it.
--
-- Fix: each table's printed QR code encodes a signed token (`?t=<token>`),
-- an HMAC of (restaurant_id, table_id) using a secret that never leaves the
-- database. Order/alert INSERT now requires a token that verifies against
-- that secret.
--
-- IMPORTANT column-security note: `restaurant_tables` is (by design) publicly
-- readable so the customer menu can resolve "table 5" -> its row. If
-- `qr_token` were just a normal column on that row, every customer would be
-- able to read every OTHER table's token too (open devtools -> read the
-- fetched table list -> spoof orders for a different table) — which would
-- defeat the whole point. So `qr_token` is protected with column-level
-- privileges (REVOKE/GRANT), not just row-level RLS: nobody can read it back
-- out through the normal table API. The restaurant's own signed-in staff get
-- it only through the get_restaurant_qr_tokens() RPC below, which checks
-- is_staff_of() before returning anything.
--
-- Run this after 0006_admin_feature_pack.sql.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Server-only secret. RLS enabled with NO policies at all: no role can
--    ever SELECT it directly via the API, only SECURITY DEFINER functions
--    (which bypass RLS as the function owner) can reach it.
-- ----------------------------------------------------------------------------
create table if not exists public.app_secrets (
  id boolean primary key default true check (id),  -- enforces exactly one row
  qr_signing_key text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (id) values (true) on conflict (id) do nothing;
revoke all on public.app_secrets from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Token generation / verification.
--    generate_qr_token is intentionally NOT reachable directly by anon or
--    authenticated (no GRANT EXECUTE below) — if it were, any signed-in
--    account could mint a valid token for a restaurant/table it doesn't own
--    just by guessing/looking up IDs, which defeats the whole point. It's
--    only ever called from inside other SECURITY DEFINER functions/triggers,
--    which run with the definer's (table owner's) privileges regardless of
--    the original caller's grants.
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
      'sha256'
    ),
    'hex'
  );
$$;
revoke execute on function public.generate_qr_token(uuid, uuid) from anon, authenticated, public;

-- verify_qr_token DOES need to be callable by anon: it runs inside the
-- orders/alerts INSERT policy's WITH CHECK, evaluated in the placing
-- customer's own (unauthenticated) session.
create or replace function public.verify_qr_token(p_restaurant_id uuid, p_table_id uuid, p_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_token is not null
    and p_token = public.generate_qr_token(p_restaurant_id, p_table_id);
$$;
grant execute on function public.verify_qr_token(uuid, uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Tables carry their own signed token, generated automatically — but the
--    column itself is locked down (see column-security note above).
-- ----------------------------------------------------------------------------
alter table public.restaurant_tables add column if not exists qr_token text;

create or replace function public.set_table_qr_token()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Backfill every table created before this migration.
update public.restaurant_tables
set qr_token = public.generate_qr_token(restaurant_id, id)
where qr_token is null;

-- Column-level lock: take away blanket table SELECT from anon/authenticated,
-- then hand it straight back MINUS qr_token. Existing app queries that do
-- `.select('*')` keep working — PostgREST simply omits columns the calling
-- role has no privilege on — they just never receive qr_token, which is the
-- point. (The existing `tables_public_read` / `tables_tenant_write` RLS
-- policies from 0001 are unaffected and keep governing which ROWS are
-- visible; this only narrows which COLUMNS are.)
revoke select on public.restaurant_tables from anon, authenticated;
grant select (id, restaurant_id, table_number, name, created_at) on public.restaurant_tables to anon, authenticated;
-- Tenant writes (insert/update/delete) still need the rest of the columns:
grant insert, update, delete on public.restaurant_tables to authenticated;

-- The Admin Panel's QR-code generator is the only place that legitimately
-- needs tokens back out — gated by is_staff_of(), same as every other
-- restaurant-scoped write in this app.
create or replace function public.get_restaurant_qr_tokens(p_restaurant_id uuid)
returns table (id uuid, table_number int, name text, qr_token text)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.table_number, t.name, t.qr_token
  from public.restaurant_tables t
  where t.restaurant_id = p_restaurant_id
    and public.is_staff_of(p_restaurant_id);
$$;
grant execute on function public.get_restaurant_qr_tokens(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Orders / alerts must carry a valid token to be inserted.
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

-- ----------------------------------------------------------------------------
-- POST-MIGRATION: any QR codes already printed before this migration ran
-- point to a URL with no ?t= token, so they'll start being rejected.
-- Reprint them from Admin Panel -> "QR Kodlar" (it now calls
-- get_restaurant_qr_tokens() to fetch each table's token for the URL).
-- ============================================================================
