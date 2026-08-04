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
