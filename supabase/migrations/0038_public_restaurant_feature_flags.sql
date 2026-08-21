-- get_public_restaurant() was missing `feature_flags` — deliberately, per
-- 0020_security_audit_hardening.sql's own comment, which grouped it with
-- plan/subscription_status/trial_ends_at as "billing/PII columns this
-- context has no business seeing". That grouping was wrong for
-- feature_flags specifically: it isn't billing/PII, it's the literal
-- on/off state of customer-visible features (Apple Pay, Google Pay,
-- banners, ...) that the customer menu itself has to read to know whether
-- to render those buttons at all.
--
-- Concretely: lib/services/entitlementService.js's hasFeature(restaurant,
-- key) reads restaurant.feature_flags?.[key] directly. Since the anon
-- customer session's `restaurant` object (fetched via this RPC) never
-- carried that column, a SuperAdmin turning Apple Pay/Google Pay OFF for
-- one specific restaurant (a restaurant-level OVERRIDE, on top of its
-- plan's default) was invisible to that restaurant's own customer menu —
-- hasFeature() had nothing to override with, so it kept falling through to
-- the PLAN's default instead. CartDrawer.jsx/CustomerApp.jsx's own wallet-
-- method gates (hasFeature(restaurant, FEATURES.GOOGLE_PAY/APPLE_PAY)) were
-- already correctly wired to look for this — the column just never arrived.
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
  feature_flags jsonb,
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
    r.table_count, r.theme_primary_color, r.theme_secondary_color, r.feature_flags,
    r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
