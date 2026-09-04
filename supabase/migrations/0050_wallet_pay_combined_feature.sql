-- ============================================================================
-- MenuFlow — Apple Pay + Google Pay entitlements collapse into one (wallet_pay)
-- ============================================================================
-- FEATURES.APPLE_PAY/FEATURES.GOOGLE_PAY used to gate two separate wallet-
-- sheet buttons (the old, never-actually-charged Payment Request API pair —
-- see lib/services/paymentService.js's own header). Once that pair was
-- removed and replaced with a single real Epoint-backed wallet button
-- (device-labelled "Apple Pay" or "Google Pay", never both at once — see
-- CustomerApp.jsx/CartDrawer.jsx), two separate plan entitlements for it
-- stopped making sense: the customer never sees two buttons to independently
-- turn on/off. This migration collapses both into one: wallet_pay.
--
-- Every write below preserves EXISTING admin intent via OR, exactly matching
-- what the app code already computed at the two call sites before this
-- migration (hasFeature(...APPLE_PAY) || hasFeature(...GOOGLE_PAY)) — this is
-- not a reset to a default, a restaurant that had explicitly turned one
-- (but not the other) on keeps behaving as "on" for the combined key.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Backfill every restaurant's feature_flags override.
-- ----------------------------------------------------------------------------
-- Old apple_pay/google_pay keys are left in place (not stripped) — harmless
-- once no code reads them, cheaper and lower-risk than rewriting every row's
-- key set for no functional gain.
update public.restaurants
set feature_flags = feature_flags || jsonb_build_object(
  'wallet_pay',
  coalesce((feature_flags ->> 'apple_pay')::boolean, false)
    or coalesce((feature_flags ->> 'google_pay')::boolean, false)
);

-- ----------------------------------------------------------------------------
-- 2. New restaurants going forward get wallet_pay in the default, not the pair.
-- ----------------------------------------------------------------------------
alter table public.restaurants
  alter column feature_flags set default '{"banners": true, "wallet_pay": true}'::jsonb;

-- ----------------------------------------------------------------------------
-- 3. plan_features (0021_plan_subscription_system.sql) — one row per plan,
--    OR of the two old rows, then drop the old rows.
-- ----------------------------------------------------------------------------
insert into public.plan_features (plan_id, feature_key, enabled)
select plan_id, 'wallet_pay', bool_or(enabled)
from public.plan_features
where feature_key in ('apple_pay', 'google_pay')
group by plan_id
on conflict (plan_id, feature_key) do update set enabled = excluded.enabled;

delete from public.plan_features where feature_key in ('apple_pay', 'google_pay');
