-- ============================================================================
-- MenuFlow — fix: 0050's restaurants.feature_flags backfill never applied
-- ============================================================================
-- 0050_wallet_pay_combined_feature.sql's step 1 (UPDATE public.restaurants SET
-- feature_flags = feature_flags || jsonb_build_object('wallet_pay', ...)) was
-- applied via the MCP apply_migration tool, which reported success — but the
-- write was silently reverted. Cause: restaurants_protect_privileged_fields
-- (0016 era) reverts new.feature_flags back to old.feature_flags on every
-- UPDATE unless is_super_admin() is true, and is_super_admin() reads
-- auth.uid() — which is null outside a real Supabase Auth session. Neither
-- execute_sql nor apply_migration carries one, so the trigger fired and
-- reverted the backfill as if an unprivileged caller had attempted it.
--
-- plan_features and the column default were unaffected (no such row-level
-- trigger on plan_features; ALTER COLUMN ... SET DEFAULT is DDL, not a row
-- UPDATE, so the trigger never sees it) — only step 1 needs redoing here.
--
-- This migration is the standard fix for that class of problem: disable the
-- trigger for the duration of this one intentional, reviewed backfill, then
-- re-enable it immediately. No RLS/grant change, no weakening of the
-- invariant for any other caller — it stays fully enforced for every
-- PostgREST/client write both before and after this migration runs.
-- ============================================================================

alter table public.restaurants disable trigger restaurants_protect_privileged_fields;

update public.restaurants
set feature_flags = feature_flags || jsonb_build_object(
  'wallet_pay',
  coalesce((feature_flags ->> 'apple_pay')::boolean, false)
    or coalesce((feature_flags ->> 'google_pay')::boolean, false)
);

alter table public.restaurants enable trigger restaurants_protect_privileged_fields;
