/**
 * Verifies lib/services/entitlementService.js's hydratePlanFeatureDefaults()
 * — the function lib/store.js's loadPlans() calls to make the entitlement
 * resolver read from the live plans/plan_features tables (see
 * supabase/migrations/0021_plan_subscription_system.sql) instead of only the
 * hardcoded PLAN_FEATURE_DEFAULTS fallback.
 *
 * Imports the real module directly (not a copy), same pattern as
 * scripts/verify-entitlements.mjs / verify-capabilities.mjs.
 *
 * Run: node scripts/verify-plans.mjs
 */
import {
  FEATURES,
  PLAN_FEATURE_DEFAULTS,
  hasFeature,
  hydratePlanFeatureDefaults,
} from '../lib/services/entitlementService.js';

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};

// Snapshot so every check below restores exactly what it changed — this
// module-level object is shared with the rest of the app's entitlement
// resolver, so a test that leaked a mutation would silently change what
// every other check (and a real hasFeature() call after this script, if
// anything ever imported both in one process) sees.
const snapshot = JSON.parse(JSON.stringify(PLAN_FEATURE_DEFAULTS));
const restore = () => {
  for (const key of Object.keys(PLAN_FEATURE_DEFAULTS)) delete PLAN_FEATURE_DEFAULTS[key];
  Object.assign(PLAN_FEATURE_DEFAULTS, JSON.parse(JSON.stringify(snapshot)));
};

// 1. No-op proof — hydrating with rows that exactly match the current
//    hardcoded defaults must leave every hasFeature() answer unchanged. This
//    is the "behavior-neutral swap" the 0021 migration's seed data promises.
{
  const rows = [
    { plan: { key: 'basic' }, feature_key: FEATURES.WALLET_PAY, enabled: false },
    { plan: { key: 'basic' }, feature_key: FEATURES.BANNERS, enabled: false },
    { plan: { key: 'pro' }, feature_key: FEATURES.WALLET_PAY, enabled: true },
    { plan: { key: 'pro' }, feature_key: FEATURES.BANNERS, enabled: true },
  ];
  const before = {
    basicBanners: hasFeature({ plan: 'basic' }, FEATURES.BANNERS),
    proWalletPay: hasFeature({ plan: 'pro' }, FEATURES.WALLET_PAY),
  };
  hydratePlanFeatureDefaults(rows);
  const after = {
    basicBanners: hasFeature({ plan: 'basic' }, FEATURES.BANNERS),
    proWalletPay: hasFeature({ plan: 'pro' }, FEATURES.WALLET_PAY),
  };
  if (before.basicBanners !== after.basicBanners || before.proWalletPay !== after.proWalletPay) {
    fail('hydrating with DB rows matching the hardcoded defaults must not change any hasFeature() answer');
  }
  restore();
}

// 2. A real change from the DB must actually take effect — proves this
//    isn't just re-reading the hardcoded object.
{
  if (hasFeature({ plan: 'basic' }, FEATURES.BANNERS) !== false) {
    fail('precondition failed: basic.banners should start false');
  }
  hydratePlanFeatureDefaults([{ plan: { key: 'basic' }, feature_key: FEATURES.BANNERS, enabled: true }]);
  if (hasFeature({ plan: 'basic' }, FEATURES.BANNERS) !== true) {
    fail('a super_admin-edited plan_features row must change what hasFeature() resolves');
  }
  restore();
}

// 3. Merge, not replace — hydrating one feature for a plan must leave that
//    plan's OTHER features exactly as they were (a partial DB fetch must
//    never blank out keys it didn't mention). Two independent witness keys
//    (WALLET_PAY, POS_INTEGRATION — both true on pro) so this can't pass by
//    accident if only one of them were left alone.
{
  hydratePlanFeatureDefaults([{ plan: { key: 'pro' }, feature_key: FEATURES.BANNERS, enabled: false }]);
  if (hasFeature({ plan: 'pro' }, FEATURES.BANNERS) !== false) {
    fail('the hydrated feature must change');
  }
  if (hasFeature({ plan: 'pro' }, FEATURES.WALLET_PAY) !== true || hasFeature({ plan: 'pro' }, FEATURES.POS_INTEGRATION) !== true) {
    fail('hydrating one feature for a plan must not blank out that plan\'s other features (merge, not replace)');
  }
  restore();
}

// 4. A brand-new plan key (not in the hardcoded object at all) must be added
//    cleanly — the day a super_admin creates a 3rd plan directly in the
//    `plans` table, its entitlements must resolve without a code change.
{
  hydratePlanFeatureDefaults([{ plan: { key: '__test_enterprise_plus__' }, feature_key: FEATURES.BANNERS, enabled: true }]);
  if (hasFeature({ plan: '__test_enterprise_plus__' }, FEATURES.BANNERS) !== true) {
    fail('a plan key not previously in PLAN_FEATURE_DEFAULTS must still be hydrated correctly');
  }
  restore();
}

// 5. Malformed rows (missing plan.key, missing feature_key) are skipped, not
//    thrown — a partial/joined-null row from Supabase must not crash the
//    whole hydration pass for every other row.
{
  try {
    hydratePlanFeatureDefaults([
      { plan: null, feature_key: FEATURES.BANNERS, enabled: true },
      { plan: {}, feature_key: FEATURES.BANNERS, enabled: true },
      { plan: { key: 'basic' }, feature_key: null, enabled: true },
      { plan: { key: 'basic' }, feature_key: FEATURES.WALLET_PAY, enabled: true },
    ]);
  } catch (err) {
    fail(`hydratePlanFeatureDefaults must not throw on malformed rows: ${err.message}`);
  }
  if (hasFeature({ plan: 'basic' }, FEATURES.WALLET_PAY) !== true) {
    fail('a valid row in the same batch as malformed ones must still be applied');
  }
  restore();
}

// 6. Empty/non-array input is a no-op, not a throw or a wipe.
{
  const before = JSON.stringify(PLAN_FEATURE_DEFAULTS);
  try {
    hydratePlanFeatureDefaults([]);
    hydratePlanFeatureDefaults(null);
    hydratePlanFeatureDefaults(undefined);
  } catch (err) {
    fail(`hydratePlanFeatureDefaults must not throw on empty/null/undefined input: ${err.message}`);
  }
  if (JSON.stringify(PLAN_FEATURE_DEFAULTS) !== before) {
    fail('empty/null/undefined input must not change PLAN_FEATURE_DEFAULTS');
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS: plan-feature hydration resolves correctly for all 6 checks');
