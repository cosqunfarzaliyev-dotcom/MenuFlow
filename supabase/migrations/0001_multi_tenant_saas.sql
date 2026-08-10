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
