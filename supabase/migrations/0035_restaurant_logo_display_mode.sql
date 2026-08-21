-- ============================================================================
-- MenuFlow — restaurant logo display mode (full logo vs. text name)
-- ============================================================================
-- Lets a restaurant_admin choose, on the CUSTOMER-facing QR menu header,
-- whether to show their full uncropped logo or just the restaurant name
-- (previous behavior). Two-value CHECK-constrained text column rather than a
-- Postgres enum type — matches this schema's existing convention (role,
-- plan, subscription_status are all `text` + `check (... in (...))`, not
-- native enums — see 0001/0021).
--
-- Backfill: a restaurant that already has a non-empty logo is currently
-- SHOWING that logo (CustomerApp.jsx's old truthy-check), so backfilling it
-- to 'logo' preserves its current visible behavior rather than silently
-- switching everyone back to name-only. Rows with an empty logo already
-- fall back to name/initial today, so 'name' is a no-op for them.
-- ============================================================================

alter table public.restaurants
  add column if not exists logo_display_mode text not null default 'name'
  check (logo_display_mode in ('name', 'logo'));

update public.restaurants
  set logo_display_mode = 'logo'
  where coalesce(logo, '') <> '' and logo_display_mode = 'name';

-- get_public_restaurant() — CLAUDE.md's explicit-column-list rule for
-- anon-exposed restaurant reads: a new column has to be added to BOTH the
-- returns table signature and the select list here, or the customer menu
-- will never see it no matter what else is done. Return shape is changing
-- (a new OUT column), so the existing function must be dropped first —
-- CREATE OR REPLACE alone can't change a function's row type.
drop function if exists public.get_public_restaurant(text);

create function public.get_public_restaurant(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  logo text,
  logo_display_mode text,
  tagline text,
  currency_symbol text,
  table_count int,
  theme_primary_color text,
  theme_secondary_color text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.slug, r.name, r.logo, r.logo_display_mode, r.tagline, r.currency_symbol,
    r.table_count, r.theme_primary_color, r.theme_secondary_color, r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
