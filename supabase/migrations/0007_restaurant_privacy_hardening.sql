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
