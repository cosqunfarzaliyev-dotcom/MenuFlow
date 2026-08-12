-- ============================================================================
-- MenuFlow — Restaurant onboarding wizard fields (0024_onboarding_completion.sql)
-- ============================================================================
-- Adds the fields the post-activation onboarding wizard needs that the
-- `restaurants` table didn't carry yet:
--
--   - phone, address: restaurant contact info, filled in during the wizard's
--     "Əlaqə" (Contact) step. No prior column existed for either — grep for
--     "restaurant.phone"/"restaurant.address" before this migration comes up
--     empty.
--   - onboarding_completed_at: null until the assigned restaurant_admin
--     finishes the wizard (app/onboarding/page.jsx ->
--     components/onboarding/OnboardingWizard.jsx). middleware.js gates
--     /admin on this being set and /onboarding on it NOT being set — a
--     restaurant_admin can't reach /admin before finishing the wizard, and
--     can't re-enter the wizard once it's done. See middleware.js for the
--     actual enforcement (this migration only adds the column it reads).
--
-- Backward compatibility: every restaurant that already exists today already
-- has a working, in-use admin panel — there is nothing to "onboard". If this
-- migration left onboarding_completed_at null for them, their restaurant_admin
-- would suddenly get bounced into the wizard on next login, unable to reach
-- /admin. Backfilled to created_at so only restaurants created AFTER this
-- migration (via superAdminService.createRestaurant, still the only creation
-- path per the locked D1 "Yol A" account model) go through the wizard.
--
-- None of these three columns are added to protect_restaurant_privileged_fields
-- (0006_admin_feature_pack.sql, extended 0016_restaurant_feature_flags.sql) —
-- they are not billing/tenant-identity fields like slug/plan/subscription_status
-- that a super_admin must own; a restaurant_admin is meant to set their own
-- contact info and complete their own onboarding. The existing
-- restaurants_owner_update RLS policy (0006) already lets a restaurant_admin
-- UPDATE their own row, so no policy change is needed either — this is purely
-- additive schema.
-- ============================================================================

alter table public.restaurants add column if not exists phone text default '';
alter table public.restaurants add column if not exists address text default '';
alter table public.restaurants add column if not exists onboarding_completed_at timestamptz;

update public.restaurants
  set onboarding_completed_at = created_at
  where onboarding_completed_at is null;
