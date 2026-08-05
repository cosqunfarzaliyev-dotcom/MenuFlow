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
