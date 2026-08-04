-- ============================================================================
-- MenuFlow — Complete Supabase Full Schema & Initial Setup
-- ============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to initialize all tables, RLS policies, functions, triggers, realtime setup,
-- storage buckets, and initial tenant structures in a single run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Base Tables Creation
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '',
  sort_order int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null default 0,
  description text default '',
  image text default '',
  is_available boolean not null default true,
  rating numeric(2, 1) default null,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.restaurant_tables (id) on delete set null,
  table_number int,
  status text not null default 'pending',
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity int not null default 1,
  price numeric(10, 2) not null default 0,
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.restaurant_tables (id) on delete set null,
  table_number int,
  type text not null,
  payment_method text,
  payment_method_label text,
  note text default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1. Multi-Tenant Tenants & Profiles
-- ----------------------------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null default 'MenuFlow',
  logo text default '',
  tagline text default '',
  currency_symbol text default '₼',
  table_count int default 20,
  theme_primary_color text not null default '#6C4CFF',
  theme_secondary_color text not null default '#14151A',
  plan text not null default 'trial',
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  owner_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'unassigned'
    check (role in ('super_admin', 'restaurant_admin', 'staff', 'unassigned')),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Trigger to create profile row when user registers
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

-- Add tenant FK columns to base tables
alter table public.categories        add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.products          add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.restaurant_tables add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.orders            add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;
alter table public.alerts            add column if not exists restaurant_id uuid references public.restaurants (id) on delete cascade;

alter table public.restaurant_tables drop constraint if exists restaurant_tables_table_number_key;
create unique index if not exists restaurant_tables_restaurant_table_number_idx
  on public.restaurant_tables (restaurant_id, table_number);

create index if not exists categories_restaurant_id_idx        on public.categories (restaurant_id);
create index if not exists products_restaurant_id_idx          on public.products (restaurant_id);
create index if not exists restaurant_tables_restaurant_id_idx on public.restaurant_tables (restaurant_id);
create index if not exists orders_restaurant_id_idx            on public.orders (restaurant_id);
create index if not exists alerts_restaurant_id_idx            on public.alerts (restaurant_id);

-- ----------------------------------------------------------------------------
-- 2. Feature Pack Tables: Banners, Campaigns, Discounts, Audit Logs
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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text default '',
  action text not null,
  entity_type text not null,
  entity_id text default '',
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_restaurant_id_idx on public.audit_logs (restaurant_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. RLS Security Functions & Policies
-- ----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_restaurant_id()
returns uuid language sql security definer set search_path = public stable as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff_of(target_restaurant_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_super_admin()
    or coalesce(
      (select role in ('restaurant_admin', 'staff') and restaurant_id = target_restaurant_id
       from public.profiles where id = auth.uid()),
      false
    );
$$;

-- Enable RLS
alter table public.restaurants        enable row level security;
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.restaurant_tables  enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.alerts             enable row level security;
alter table public.banners           enable row level security;
alter table public.campaigns         enable row level security;
alter table public.discounts         enable row level security;
alter table public.audit_logs        enable row level security;

-- Policies
drop policy if exists "restaurants_public_read" on public.restaurants;
create policy "restaurants_public_read" on public.restaurants for select using (true);

drop policy if exists "restaurants_owner_update" on public.restaurants;
create policy "restaurants_owner_update" on public.restaurants for update to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'restaurant_admin' and restaurant_id = restaurants.id)
  );

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update to authenticated using (id = auth.uid() or public.is_super_admin());

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select using (true);
drop policy if exists "categories_tenant_write" on public.categories;
create policy "categories_tenant_write" on public.categories for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);
drop policy if exists "products_tenant_write" on public.products;
create policy "products_tenant_write" on public.products for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "tables_public_read" on public.restaurant_tables;
create policy "tables_public_read" on public.restaurant_tables for select using (true);
drop policy if exists "tables_tenant_write" on public.restaurant_tables;
create policy "tables_tenant_write" on public.restaurant_tables for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders for insert with check (true);
drop policy if exists "orders_tenant_read" on public.orders;
create policy "orders_tenant_read" on public.orders for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "orders_tenant_update" on public.orders;
create policy "orders_tenant_update" on public.orders for update to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "orders_tenant_delete" on public.orders;
create policy "orders_tenant_delete" on public.orders for delete to authenticated using (public.is_staff_of(restaurant_id));

drop policy if exists "order_items_public_insert" on public.order_items;
create policy "order_items_public_insert" on public.order_items for insert with check (true);
drop policy if exists "order_items_tenant_read" on public.order_items;
create policy "order_items_tenant_read" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and public.is_staff_of(o.restaurant_id))
);

drop policy if exists "alerts_public_insert" on public.alerts;
create policy "alerts_public_insert" on public.alerts for insert with check (true);
drop policy if exists "alerts_tenant_read" on public.alerts;
create policy "alerts_tenant_read" on public.alerts for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "alerts_tenant_update" on public.alerts;
create policy "alerts_tenant_update" on public.alerts for update to authenticated using (public.is_staff_of(restaurant_id));

drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners for select using (true);
drop policy if exists "banners_tenant_write" on public.banners;
create policy "banners_tenant_write" on public.banners for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "campaigns_public_read" on public.campaigns;
create policy "campaigns_public_read" on public.campaigns for select using (true);
drop policy if exists "campaigns_tenant_write" on public.campaigns;
create policy "campaigns_tenant_write" on public.campaigns for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "discounts_public_read" on public.discounts;
create policy "discounts_public_read" on public.discounts for select using (true);
drop policy if exists "discounts_tenant_write" on public.discounts;
create policy "discounts_tenant_write" on public.discounts for all to authenticated using (public.is_staff_of(restaurant_id)) with check (public.is_staff_of(restaurant_id));

drop policy if exists "audit_logs_tenant_read" on public.audit_logs;
create policy "audit_logs_tenant_read" on public.audit_logs for select to authenticated using (public.is_staff_of(restaurant_id));
drop policy if exists "audit_logs_tenant_insert" on public.audit_logs;
create policy "audit_logs_tenant_insert" on public.audit_logs for insert to authenticated with check (public.is_staff_of(restaurant_id));

-- ----------------------------------------------------------------------------
-- 4. RPC Security Definer Functions (Self-Service Signup & Admin User Directory)
-- ----------------------------------------------------------------------------
create or replace function public.create_my_restaurant(
  p_slug text,
  p_name text,
  p_tagline text default '',
  p_currency_symbol text default '₼',
  p_table_count int default 20
)
returns public.restaurants language plpgsql security definer set search_path = public as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_restaurant_id uuid;
  new_restaurant public.restaurants;
  clean_slug text;
  safe_table_count int;
begin
  if caller_id is null then raise exception 'Bu əməliyyat üçün daxil olmalısınız.' using errcode = 'P0001'; end if;
  select restaurant_id, email into caller_restaurant_id, caller_email from public.profiles where id = caller_id;
  if caller_restaurant_id is not null then raise exception 'Bu hesab artıq bir restorana bağlıdır.' using errcode = 'P0001'; end if;

  clean_slug := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9-]+', '-', 'g'));
  if clean_slug = '' or clean_slug is null then raise exception 'Etibarlı bir slug daxil edin.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.restaurants where slug = clean_slug) then raise exception 'Bu slug artıq istifadə olunur, başqasını seçin.' using errcode = 'P0001'; end if;

  safe_table_count := greatest(1, least(200, coalesce(p_table_count, 20)));

  insert into public.restaurants (slug, name, tagline, currency_symbol, table_count, is_active, plan, subscription_status, trial_ends_at, owner_email)
  values (clean_slug, coalesce(nullif(trim(p_name), ''), 'MenuFlow'), coalesce(p_tagline, ''), coalesce(nullif(p_currency_symbol, ''), '₼'), safe_table_count, true, 'trial', 'trialing', now() + interval '14 days', caller_email)
  returning * into new_restaurant;

  update public.profiles set role = 'restaurant_admin', restaurant_id = new_restaurant.id where id = caller_id;

  insert into public.restaurant_tables (restaurant_id, table_number, name)
  select new_restaurant.id, gs, 'Masa ' || gs
  from generate_series(1, safe_table_count) as gs;

  return new_restaurant;
end;
$$;
grant execute on function public.create_my_restaurant(text, text, text, text, int) to authenticated;

create or replace function public.get_platform_users()
returns table (
  id uuid,
  email text,
  role text,
  restaurant_id uuid,
  restaurant_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
) language sql security definer set search_path = public stable as $$
  select
    p.id, p.email, p.role, p.restaurant_id, r.name as restaurant_name, p.created_at, u.last_sign_in_at
  from public.profiles p
  left join public.restaurants r on r.id = p.restaurant_id
  left join auth.users u on u.id = p.id
  where public.is_super_admin() and p.role in ('super_admin', 'restaurant_admin', 'staff')
  order by u.last_sign_in_at desc nulls last;
$$;
grant execute on function public.get_platform_users() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Realtime Publication & Storage Buckets
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.alerts;
    alter publication supabase_realtime add table public.restaurant_tables;
    alter publication supabase_realtime add table public.products;
    alter publication supabase_realtime add table public.categories;
    alter publication supabase_realtime add table public.banners;
    alter publication supabase_realtime add table public.campaigns;
    alter publication supabase_realtime add table public.discounts;
  end if;
exception
  when others then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menuflow', 'menuflow', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update set public = true;

drop policy if exists "menuflow_public_select" on storage.objects;
create policy "menuflow_public_select" on storage.objects for select using (bucket_id = 'menuflow');
drop policy if exists "menuflow_authenticated_insert" on storage.objects;
create policy "menuflow_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'menuflow');
drop policy if exists "menuflow_authenticated_update" on storage.objects;
create policy "menuflow_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'menuflow');
drop policy if exists "menuflow_authenticated_delete" on storage.objects;
create policy "menuflow_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'menuflow');
