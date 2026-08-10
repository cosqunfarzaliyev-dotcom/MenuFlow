-- ============================================================================
-- MenuFlow — Base Database Schema (0000_initial_schema.sql)
-- ============================================================================
-- Base tables for categories, products, restaurant_tables, orders,
-- order_items, and alerts. Run this before 0001_multi_tenant_saas.sql on a new DB.
-- ============================================================================

-- 1. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

-- 2. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null default 0,
  description text default '',
  image text default '',
  is_available boolean not null default true,
  rating numeric(2, 1) default null,
  created_at timestamptz not null default now()
);

-- 3. Restaurant Tables
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number int not null,
  name text,
  status text default 'empty',
  is_occupied boolean default false,
  bill_requested boolean default false,
  call_waiter boolean default false,
  last_call_time timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.restaurant_tables (id) on delete set null,
  table_number int,
  status text not null default 'pending',
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Order Items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity int not null default 1,
  price numeric(10, 2) not null default 0,
  note text default '',
  created_at timestamptz not null default now()
);

-- 6. Alerts (Waiter Calls & Bill Requests)
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.restaurant_tables (id) on delete set null,
  table_number int,
  type text not null, -- 'waiter' | 'bill'
  payment_method text,
  payment_method_label text,
  note text default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
-- ============================================================================
-- MenuFlow — Multi-tenant SaaS migration
-- ============================================================================
-- Turns the single-restaurant schema into a multi-tenant one with three roles:
--   super_admin     -> platform owner, manages all restaurants + their admins
--   restaurant_admin -> manages a single restaurant (menu, tables, settings)
--   staff            -> works the floor for a single restaurant (orders/alerts)
--
-- Run this once in the Supabase SQL editor of your project.
-- Safe-guarded with IF NOT EXISTS / DO blocks so it can be re-run if it fails
-- partway through.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RESTAURANTS (tenants)
-- ----------------------------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null default 'MenuFlow',
  logo text default '',
  tagline text default '',
  currency_symbol text default '₼',
  table_count int default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES (links auth.users -> role + restaurant)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'unassigned'
    check (role in ('super_admin', 'restaurant_admin', 'staff', 'unassigned')),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- New users start as 'unassigned' with no restaurant until a super_admin
-- assigns them a role (see superAdminService.assignAdmin in the app code).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'unassigned')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for any users created before this migration ran.
insert into public.profiles (id, email, role)
select u.id, u.email, 'unassigned'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ----------------------------------------------------------------------------
-- 3. Add restaurant_id (tenant key) to existing tables
-- ----------------------------------------------------------------------------
alter table public.categories        add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.products          add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.restaurant_tables add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.orders            add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.alerts            add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;

-- table_number used to be globally unique; now it only needs to be unique
-- per restaurant, since every tenant has its own "Masa 1..N".
alter table public.restaurant_tables drop constraint if exists restaurant_tables_table_number_key;
create unique index if not exists restaurant_tables_restaurant_table_number_idx
  on public.restaurant_tables (restaurant_id, table_number);

create index if not exists categories_restaurant_id_idx        on public.categories (restaurant_id);
create index if not exists products_restaurant_id_idx          on public.products (restaurant_id);
create index if not exists restaurant_tables_restaurant_id_idx on public.restaurant_tables (restaurant_id);
create index if not exists orders_restaurant_id_idx            on public.orders (restaurant_id);
create index if not exists alerts_restaurant_id_idx            on public.alerts (restaurant_id);

-- ----------------------------------------------------------------------------
-- 4. One-time data migration: put all pre-existing rows into a single
--    "default" restaurant so nothing already in production is orphaned.
-- ----------------------------------------------------------------------------
do $$
declare
  default_restaurant_id uuid;
begin
  if exists (select 1 from public.products where restaurant_id is null)
     or exists (select 1 from public.categories where restaurant_id is null)
     or exists (select 1 from public.restaurant_tables where restaurant_id is null) then

    insert into public.restaurants (slug, name, tagline)
    values ('default', 'MenuFlow', 'Rəqəmsal QR Menyu və İdarəetmə Sistemi')
    on conflict (slug) do update set slug = excluded.slug
    returning id into default_restaurant_id;

    if default_restaurant_id is null then
      select id into default_restaurant_id from public.restaurants where slug = 'default';
    end if;

    update public.categories        set restaurant_id = default_restaurant_id where restaurant_id is null;
    update public.products          set restaurant_id = default_restaurant_id where restaurant_id is null;
    update public.restaurant_tables set restaurant_id = default_restaurant_id where restaurant_id is null;
    update public.orders            set restaurant_id = default_restaurant_id where restaurant_id is null;
    update public.alerts            set restaurant_id = default_restaurant_id where restaurant_id is null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Helper functions for RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_restaurant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff_of(target_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_super_admin()
    or coalesce(
      (select role in ('restaurant_admin', 'staff') and restaurant_id = target_restaurant_id
       from public.profiles where id = auth.uid()),
      false
    );
$$;

-- ----------------------------------------------------------------------------
-- 6. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.restaurants        enable row level security;
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.restaurant_tables  enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.alerts             enable row level security;

-- restaurants: public can read active restaurants (needed to resolve a QR
-- slug on the customer menu, which is not authenticated); only super_admin
-- can create/update/delete tenants.
drop policy if exists "restaurants_public_read" on public.restaurants;
create policy "restaurants_public_read" on public.restaurants
  for select using (true);

drop policy if exists "restaurants_super_admin_write" on public.restaurants;
create policy "restaurants_super_admin_write" on public.restaurants
  for insert to authenticated with check (public.is_super_admin());
drop policy if exists "restaurants_super_admin_update" on public.restaurants;
create policy "restaurants_super_admin_update" on public.restaurants
  for update to authenticated using (public.is_super_admin());
drop policy if exists "restaurants_super_admin_delete" on public.restaurants;
create policy "restaurants_super_admin_delete" on public.restaurants
  for delete to authenticated using (public.is_super_admin());

-- profiles: a user can read/update their own row; super_admin can read and
-- update everyone's role/restaurant assignment.
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_super_admin());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_super_admin());

-- categories / products / restaurant_tables: menu is public read (customer
-- app is unauthenticated); writes are limited to that restaurant's staff or
-- a super_admin.
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (true);
drop policy if exists "categories_tenant_write" on public.categories;
create policy "categories_tenant_write" on public.categories
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);
drop policy if exists "products_tenant_write" on public.products;
create policy "products_tenant_write" on public.products
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "tables_public_read" on public.restaurant_tables;
create policy "tables_public_read" on public.restaurant_tables for select using (true);
drop policy if exists "tables_tenant_write" on public.restaurant_tables;
create policy "tables_tenant_write" on public.restaurant_tables
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

-- orders / order_items / alerts: anyone (incl. unauthenticated customers)
-- can INSERT — placing an order doesn't require login — but only that
-- restaurant's staff (or super_admin) can read/update/delete them.
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders for insert with check (true);
drop policy if exists "orders_tenant_read" on public.orders;
create policy "orders_tenant_read" on public.orders
  for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "orders_tenant_update" on public.orders;
create policy "orders_tenant_update" on public.orders
  for update to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "orders_tenant_delete" on public.orders;
create policy "orders_tenant_delete" on public.orders
  for delete to authenticated using (public.is_staff_of(restaurant_id));

drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert" on public.order_items for insert with check (true);
drop policy if exists "order_items_tenant_read" on public.order_items;
create policy "order_items_tenant_read" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and public.is_staff_of(o.restaurant_id))
  );

drop policy if exists "alerts_public_insert" on public.alerts;
create policy "alerts_public_insert" on public.alerts for insert with check (true);
drop policy if exists "alerts_tenant_read" on public.alerts;
create policy "alerts_tenant_read" on public.alerts
  for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "alerts_tenant_update" on public.alerts;
create policy "alerts_tenant_update" on public.alerts
  for update to authenticated using (public.is_staff_of(restaurant_id));

-- ============================================================================
-- POST-MIGRATION MANUAL STEP (do this once, in the Supabase SQL editor):
--
--   1. Sign up normally through the app (or Authentication > Users > Invite)
--      with the email you want to use as the platform owner.
--   2. Promote that user to super_admin:
--
--        update public.profiles set role = 'super_admin' where email = 'you@example.com';
--
--   3. Log into /superadmin with that account.
-- ============================================================================
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
-- ============================================================================
-- MenuFlow — Billing fields + self-service restaurant signup
-- ============================================================================
-- Run this after 0001_multi_tenant_saas.sql and 0002_security_hardening.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Billing / trial state on each restaurant
-- ----------------------------------------------------------------------------
alter table public.restaurants add column if not exists plan text not null default 'trial';
alter table public.restaurants add column if not exists subscription_status text not null default 'trialing'
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));
alter table public.restaurants add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

-- ----------------------------------------------------------------------------
-- 2. SECURITY FIX: the original profiles_self_update policy (0001) let a
--    signed-in user UPDATE their *own* profiles row with no column
--    restriction — including `role` and `restaurant_id`. That means any
--    authenticated user could open the browser console and run:
--        supabase.from('profiles').update({ role: 'super_admin' }).eq('id', myId)
--    and grant themselves platform-owner access. Only a super_admin (or the
--    security-definer signup function below) should ever be able to change
--    role/restaurant_id.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_super_admin_update" on public.profiles
  for update to authenticated using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. Self-service restaurant signup
-- ----------------------------------------------------------------------------
-- A newly signed-up user (role = 'unassigned', no restaurant yet) can create
-- their own restaurant and become its restaurant_admin, starting a trial —
-- no super_admin action required. This runs as SECURITY DEFINER so it can
-- write to restaurants/profiles/restaurant_tables despite RLS, but it
-- enforces its own rules: caller must be logged in, and can't already own a
-- restaurant (prevents one account silently taking over multiple tenants
-- through this path — a super_admin can still assign additional ones
-- manually if that's ever needed).
create or replace function public.create_restaurant_self_service(
  p_slug text,
  p_name text,
  p_tagline text default '',
  p_currency_symbol text default '₼',
  p_table_count int default 20
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_restaurant_id uuid;
  new_restaurant public.restaurants;
  safe_table_count int := greatest(1, least(200, coalesce(p_table_count, 20)));
begin
  if caller_id is null then
    raise exception 'Bu əməliyyat üçün daxil olmusunuz olmalısınız.' using errcode = 'P0001';
  end if;

  select restaurant_id into caller_restaurant_id from public.profiles where id = caller_id;
  if caller_restaurant_id is not null then
    raise exception 'Bu hesab artıq bir restorana bağlıdır.' using errcode = 'P0001';
  end if;

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at)
  values (p_slug, p_name, coalesce(p_tagline, ''), coalesce(p_currency_symbol, '₼'), safe_table_count, true, 'trial', 'trialing', now() + interval '14 days')
  returning * into new_restaurant;

  insert into public.restaurant_tables (restaurant_id, table_number, name)
  select new_restaurant.id, i, 'Masa ' || i
  from generate_series(1, safe_table_count) as i;

  update public.profiles
  set role = 'restaurant_admin', restaurant_id = new_restaurant.id
  where id = caller_id;

  return new_restaurant;
exception
  when unique_violation then
    raise exception 'Bu slug artıq istifadə olunur, başqa bir ad seçin.' using errcode = 'P0001';
end;
$$;

grant execute on function public.create_restaurant_self_service(text, text, text, text, int) to authenticated;
-- ============================================================================
-- MenuFlow — optional per-product rating
-- ============================================================================
-- Nullable, additive column: the redesigned customer product card can show
-- a rating badge when one is set, and simply omits it when null — no
-- fabricated data, no impact on existing rows or RLS (already covered by
-- the products_public_read / products_tenant_write policies from
-- 0001_multi_tenant_saas.sql).
-- ============================================================================

alter table public.products add column if not exists rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5));
-- ============================================================================
-- MenuFlow — Super Admin user directory
-- ============================================================================
-- Powers the "İstifadəçilər" (User Management) tab of /superadmin.
--
-- profiles has no last-login tracking of its own, but Supabase Auth already
-- maintains auth.users.last_sign_in_at for every account. Rather than
-- duplicating that into a new column (and having to remember to touch it on
-- every login), this exposes it read-only via a security-definer RPC that
-- only a super_admin can call — no service-role key needed client-side.
-- ============================================================================

create or replace function public.get_platform_users()
returns table (
  id uuid,
  email text,
  role text,
  restaurant_id uuid,
  restaurant_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.email,
    p.role,
    p.restaurant_id,
    r.name as restaurant_name,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  left join public.restaurants r on r.id = p.restaurant_id
  left join auth.users u on u.id = p.id
  where public.is_super_admin()
    and p.role in ('super_admin', 'restaurant_admin', 'staff')
  order by u.last_sign_in_at desc nulls last;
$$;

grant execute on function public.get_platform_users() to authenticated;
-- ============================================================================
-- MenuFlow — Admin feature pack
-- ============================================================================
-- Adds exactly the features requested for the restaurant Admin Panel:
--   - Theme Builder (per-restaurant colors) + Banner system  -> restaurant design
--   - Campaigns + Discounts (auto-applied to product prices)
--   - Audit log (who / when / what changed) for admin actions
--   - A payment_method check that accepts google_pay / apple_pay in addition
--     to cash / card (the actual wallet integration lives in the frontend
--     via the browser Payment Request API — see lib/services/paymentService.js)
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Restaurant design: theme colors (logo already existed on restaurants)
-- ----------------------------------------------------------------------------
alter table public.restaurants add column if not exists theme_primary_color text not null default '#6C4CFF';
alter table public.restaurants add column if not exists theme_secondary_color text not null default '#14151A';

-- Product variants/add-ons (Restoran dizaynı -> Variantlar, e.g. Ölçü:
-- Kiçik/Orta/Böyük, Əlavələr: Göbələk/Pendir/Zeytun) with per-choice extra
-- price, so checkout can auto-calculate the total. The customer-facing UI
-- already reads product.options; this just guarantees the column exists so
-- the new Admin Panel editor has somewhere to save it.
alter table public.products add column if not exists options jsonb not null default '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. Banners (restaurant design -> banner system)
-- ----------------------------------------------------------------------------
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text default '',
  subtitle text default '',
  image_url text not null,
  link_url text default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists banners_restaurant_id_idx on public.banners (restaurant_id);

-- ----------------------------------------------------------------------------
-- 3. Campaigns (Admin -> "Kampaniya")
-- ----------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  description text default '',
  banner_image_url text default '',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_restaurant_id_idx on public.campaigns (restaurant_id);

-- ----------------------------------------------------------------------------
-- 4. Discounts (top-level "Endirimlər" + Admin -> "Endirim")
--    Either store-wide (product_id null) or scoped to one product.
--    Optionally attached to a campaign.
-- ----------------------------------------------------------------------------
create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  product_id uuid references public.products (id) on delete cascade,
  title text not null,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed')),
  value numeric(10, 2) not null check (value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists discounts_restaurant_id_idx on public.discounts (restaurant_id);
create index if not exists discounts_product_id_idx on public.discounts (product_id);

-- ----------------------------------------------------------------------------
-- 5. Audit log (Admin -> "Audit Log": Kim / Nə vaxt / Nəyi dəyişib)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text default '',
  action text not null,          -- e.g. 'product.create', 'discount.delete', 'theme.update'
  entity_type text not null,     -- e.g. 'product', 'discount', 'campaign', 'banner', 'settings'
  entity_id text default '',
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_restaurant_id_idx on public.audit_logs (restaurant_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 6. Payments: allow the two new wallet methods on alerts.payment_method
--    (kept permissive/text elsewhere on purpose, this only adds a comment —
--    no existing check constraint to widen).
-- ----------------------------------------------------------------------------
comment on column public.alerts.payment_method is
  'cash | card | google_pay | apple_pay';

-- ----------------------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.banners     enable row level security;
alter table public.campaigns   enable row level security;
alter table public.discounts   enable row level security;
alter table public.audit_logs  enable row level security;

-- banners / campaigns / discounts: public read (the customer menu is
-- unauthenticated and needs to show active banners + apply discounts);
-- writes limited to that restaurant's admin/staff or a super_admin.
drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners for select using (true);
drop policy if exists "banners_tenant_write" on public.banners;
create policy "banners_tenant_write" on public.banners
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "campaigns_public_read" on public.campaigns;
create policy "campaigns_public_read" on public.campaigns for select using (true);
drop policy if exists "campaigns_tenant_write" on public.campaigns;
create policy "campaigns_tenant_write" on public.campaigns
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "discounts_public_read" on public.discounts;
create policy "discounts_public_read" on public.discounts for select using (true);
drop policy if exists "discounts_tenant_write" on public.discounts;
create policy "discounts_tenant_write" on public.discounts
  for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

-- audit_logs: only that restaurant's admin/staff (or super_admin) can read;
-- any authenticated staff of that restaurant can insert (they're the actor).
drop policy if exists "audit_logs_tenant_read" on public.audit_logs;
create policy "audit_logs_tenant_read" on public.audit_logs
  for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "audit_logs_tenant_insert" on public.audit_logs;
create policy "audit_logs_tenant_insert" on public.audit_logs
  for insert to authenticated with check (public.is_staff_of(restaurant_id));

-- restaurants: a restaurant_admin may now update their OWN restaurant's row
-- (needed so branding/theme/logo changes from the Admin Panel persist —
-- previously only super_admin could write to this table).
--
-- ⚠️ RLS is ROW-level, not column-level: on its own, this policy would let a
-- restaurant_admin PATCH *any* column on their own row — including
-- `plan`, `subscription_status`, `trial_ends_at`, `is_active`, `slug` —
-- straight from the browser console, e.g.
--   supabase.from('restaurants').update({ subscription_status: 'active' })...
-- which is a free, permanent "upgrade" that skips billing entirely (the same
-- class of bug 0003_billing_self_service.sql already had to close on
-- `profiles`). The trigger below closes it here too: it silently reverts
-- billing/identity fields to their previous value unless the caller is a
-- super_admin, no matter what the UPDATE statement sent.
drop policy if exists "restaurants_owner_update" on public.restaurants;
create policy "restaurants_owner_update" on public.restaurants
  for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'restaurant_admin' and restaurant_id = restaurants.id
    )
  );

create or replace function public.protect_restaurant_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    new.slug := old.slug;
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_protect_privileged_fields on public.restaurants;
create trigger restaurants_protect_privileged_fields
  before update on public.restaurants
  for each row execute procedure public.protect_restaurant_privileged_fields();
-- ============================================================================
-- MenuFlow — Restaurant privacy hardening
-- ============================================================================
-- 0001_multi_tenant_saas.sql made `restaurants` fully public-readable
-- (`for select using (true)`) so the unauthenticated customer menu could
-- resolve a QR slug. That also means anyone with the public anon key can
-- run `supabase.from('restaurants').select('*')` directly and read every
-- tenant's `plan`, `subscription_status`, and `trial_ends_at` — business
-- data that was never meant to be world-readable.
--
-- Fix: the customer-facing menu only ever needs a handful of branding
-- columns (see restaurants_public below). We expose exactly those through a
-- view, and lock the base table down to that restaurant's own staff/admin
-- (or a super_admin) — the standard Postgres pattern for "public view over
-- a privacy-restricted table" (the view runs with its owner's privileges,
-- so it bypasses the base table's RLS and only ever returns the columns
-- listed in its definition).
--
-- Run this after 0001_multi_tenant_saas.sql.
-- ============================================================================

drop policy if exists "restaurants_public_read" on public.restaurants;

drop policy if exists "restaurants_staff_read" on public.restaurants;
create policy "restaurants_staff_read" on public.restaurants
  for select to authenticated using (public.is_staff_of(id));

create or replace view public.restaurants_public as
select
  id,
  slug,
  name,
  logo,
  tagline,
  currency_symbol,
  table_count,
  theme_primary_color,
  theme_secondary_color,
  is_active,
  created_at
from public.restaurants
where is_active = true;

grant select on public.restaurants_public to anon, authenticated;
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
  qr_signing_key text not null default encode(gen_random_bytes(32), 'hex')
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
set search_path = public
stable
as $$
  select encode(
    hmac(
      p_restaurant_id::text || ':' || p_table_id::text,
      (select qr_signing_key from public.app_secrets limit 1),
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
-- ============================================================================
-- MenuFlow — payment_method on orders (not just alerts)
-- ============================================================================
-- alerts.payment_method already tracks how a customer wants to pay when
-- they request the bill (0006_admin_feature_pack.sql). Orders themselves had
-- no equivalent, so there was nowhere to record "customer chose Google
-- Pay/Apple Pay when sending this order to the kitchen" — kitchen/staff had
-- no visibility into it at order time, only later at bill time.
--
-- Same pattern as alerts: plain text column, no check constraint (kept
-- permissive on purpose), just a comment documenting the expected values.
-- ============================================================================

alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_method_label text;

comment on column public.orders.payment_method is
  'cash | card | google_pay | apple_pay';
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
