/**
 * Verifies the feature-entitlement precedence chain in
 * lib/services/entitlementService.js resolves correctly for every case that
 * matters in production: explicit overrides, plan defaults, the customer
 * surface's missing columns, unknown keys, and a still-loading restaurant.
 *
 * Imports the real module directly (not a copy) so this catches drift
 * between the resolver and this test, not just between two hand-written
 * expectations. Node 24 auto-detects the ESM `export` syntax in a plain
 * `.js` file and reparses it with a one-time stderr warning; that warning is
 * harmless and does not affect the exit code (verified before writing this
 * script).
 *
 * Run: node scripts/verify-entitlements.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  FEATURES,
  FEATURE_REGISTRY,
  FEATURE_KEYS,
  PLAN_FEATURE_DEFAULTS,
  hasFeature,
  getEntitlements,
} from '../lib/services/entitlementService.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};

// 1. Grandfather guard — the three launch keys must default ON. If someone
//    "fixes" this thinking it's a bug, banners + wallet buttons vanish from
//    every customer menu with no code change anywhere else.
for (const key of [FEATURES.APPLE_PAY, FEATURES.GOOGLE_PAY, FEATURES.BANNERS]) {
  if (FEATURE_REGISTRY[key].defaultEnabled !== true) {
    fail(`${key} must have defaultEnabled: true (grandfathered legacy default)`);
  }
}

// 2. Customer-surface parity — restaurants_public exposes neither
//    feature_flags nor plan (verified against the live view definition).
//    Every launch feature must still resolve true, matching the old
//    `restaurant?.feature_flags?.x !== false` reading exactly.
//
//    Scoped to the same grandfathered launch keys as check 1, NOT all of
//    FEATURE_KEYS — a feature added later (e.g. pos_integration, an
//    admin-only entitlement that deliberately defaults false, see its own
//    FEATURE_REGISTRY comment) is neither customer-facing nor grandfathered,
//    so it has no business being asserted true here. Looping over every
//    registered key would make this check fail the moment ANY new
//    defaultEnabled:false feature is registered, regardless of whether it
//    has anything to do with the customer surface.
{
  const customerSurfaceRow = { id: 'r1', slug: 'demo', name: 'Demo', is_active: true };
  for (const key of [FEATURES.APPLE_PAY, FEATURES.GOOGLE_PAY, FEATURES.BANNERS]) {
    if (hasFeature(customerSurfaceRow, key) !== true) {
      fail(`customer-surface row (no feature_flags/plan) must resolve ${key} to true, got ${hasFeature(customerSurfaceRow, key)}`);
    }
  }
}

// 3. Explicit override beats plan, in both directions.
{
  const overrideOff = { plan: 'pro', feature_flags: { banners: false } };
  if (hasFeature(overrideOff, FEATURES.BANNERS) !== false) {
    fail('explicit false override must beat a pro-plan true default');
  }
  const overrideOn = { plan: 'basic', feature_flags: { banners: true } };
  if (hasFeature(overrideOn, FEATURES.BANNERS) !== true) {
    fail('explicit true override must beat a basic-plan false default');
  }
}

// 4. Plan governs when the key is absent from feature_flags but a plan is
//    known — exercised on a synthetic registry key so it isn't masked by the
//    real keys' `defaultEnabled: true` grandfathering.
{
  const originalRegistry = { ...FEATURE_REGISTRY };
  FEATURE_REGISTRY.__test_key__ = { label: 'Test', description: '', defaultEnabled: false, enforcement: 'ui' };
  PLAN_FEATURE_DEFAULTS.pro.__test_key__ = true;
  PLAN_FEATURE_DEFAULTS.basic.__test_key__ = false;

  if (hasFeature({ plan: 'pro' }, '__test_key__') !== true) {
    fail('a key absent from feature_flags must fall through to the pro plan default (true)');
  }
  if (hasFeature({ plan: 'basic' }, '__test_key__') !== false) {
    fail('a key absent from feature_flags must fall through to the basic plan default (false)');
  }

  delete PLAN_FEATURE_DEFAULTS.pro.__test_key__;
  delete PLAN_FEATURE_DEFAULTS.basic.__test_key__;
  delete FEATURE_REGISTRY.__test_key__;
  // Registry mutated in place, not reassigned — restoring individual keys is
  // enough to leave FEATURE_REGISTRY exactly as it started.
  void originalRegistry;
}

// 5. Loading state — a null restaurant must resolve every key to its
//    registry default and must never throw.
{
  for (const key of FEATURE_KEYS) {
    let result;
    try {
      result = hasFeature(null, key);
    } catch (err) {
      fail(`hasFeature(null, ${key}) threw: ${err.message}`);
      continue;
    }
    if (result !== FEATURE_REGISTRY[key].defaultEnabled) {
      fail(`hasFeature(null, ${key}) should equal the registry default (${FEATURE_REGISTRY[key].defaultEnabled}), got ${result}`);
    }
  }
}

// 6. Fail closed on an unknown key; getEntitlements() returns exactly the
//    registry's keys, no more, no less.
{
  if (hasFeature({ plan: 'pro' }, 'not_a_real_feature') !== false) {
    fail('an unknown feature key must resolve to false, not throw or default true');
  }
  const entitlements = getEntitlements({ plan: 'pro' });
  const gotKeys = Object.keys(entitlements).sort();
  const wantKeys = [...FEATURE_KEYS].sort();
  if (JSON.stringify(gotKeys) !== JSON.stringify(wantKeys)) {
    fail(`getEntitlements() keys ${JSON.stringify(gotKeys)} must exactly equal FEATURE_KEYS ${JSON.stringify(wantKeys)}`);
  }
}

// 7. Legacy plans ('free' / 'enterprise' / null) with explicit flags resolve
//    via the override (step 3), not by being silently downgraded to basic.
{
  const legacyRow = { plan: 'enterprise', feature_flags: { banners: true, apple_pay: false, google_pay: true } };
  if (hasFeature(legacyRow, FEATURES.BANNERS) !== true) fail("legacy plan 'enterprise' with explicit banners:true must resolve true");
  if (hasFeature(legacyRow, FEATURES.APPLE_PAY) !== false) fail("legacy plan 'enterprise' with explicit apple_pay:false must resolve false");
}

// 8. Plan-matrix completeness — every declared plan covers every registry
//    key. Catches "added a feature key, forgot to add it to a plan."
{
  for (const [plan, flags] of Object.entries(PLAN_FEATURE_DEFAULTS)) {
    for (const key of FEATURE_KEYS) {
      if (typeof flags[key] !== 'boolean') {
        fail(`PLAN_FEATURE_DEFAULTS.${plan} is missing a boolean for '${key}'`);
      }
    }
  }
}

// 9. Write-path no-op proof — every shape that already exists in the
//    codebase today (DB column default; basic/pro plan seeds) must resolve
//    to itself when read back, i.e. the resolver introduces no observable
//    change for already-provisioned restaurants.
//
//    Each shape is checked against its OWN declared keys (Object.keys(flags)),
//    not the full FEATURE_KEYS list. 'DB column default (0016)' deliberately
//    stays a 3-key snapshot of what that migration actually wrote — it
//    documents a real historical row shape, from before pos_integration
//    (0026) existed, and a restaurant row provisioned back then genuinely
//    has no pos_integration key in its feature_flags jsonb. Falling through
//    to the plan default for that missing key is correct new behavior for a
//    newly-registered feature, not a regression this check should catch;
//    padding the shape with a guessed value would make it stop representing
//    real historical data. (PLAN_FEATURE_DEFAULTS.basic/pro happen to cover
//    every current key already — check 8 is what actually enforces that.)
{
  const shapes = [
    { name: 'DB column default (0016)', flags: { apple_pay: true, google_pay: true, banners: true } },
    { name: 'PLAN_FEATURE_DEFAULTS.basic', flags: PLAN_FEATURE_DEFAULTS.basic },
    { name: 'PLAN_FEATURE_DEFAULTS.pro', flags: PLAN_FEATURE_DEFAULTS.pro },
  ];
  for (const { name, flags } of shapes) {
    const restaurant = { plan: 'basic', feature_flags: flags };
    for (const key of Object.keys(flags)) {
      if (hasFeature(restaurant, key) !== flags[key]) {
        fail(`${name}: resolved ${key}=${hasFeature(restaurant, key)}, expected ${flags[key]} (explicit flags must always win)`);
      }
    }
  }
}

// 10. /pricing must have a human label for EVERY registered feature.
//    app/[locale]/pricing/page.jsx maps feature key -> pricing.js key via
//    FEATURE_LABEL_KEYS, falling back to `t(key)`, whose own last resort is
//    the raw key — so a feature added to FEATURES without a label here
//    silently renders as a literal `pos_integration` on the PUBLIC pricing
//    page. That is exactly what happened when POS_INTEGRATION and
//    PUSH_NOTIFICATIONS were registered; this check is why it can't recur.
//    Text assertions (not import) because both files resolve via the `@/`
//    alias that plain Node can't follow — same reasoning as
//    scripts/verify-i18n-keys.mjs's own header.
{
  const pricingPage = readFileSync(path.join(ROOT, 'app', '[locale]', 'pricing', 'page.jsx'), 'utf8');
  const pricingDict = readFileSync(path.join(ROOT, 'lib', 'i18n', 'dictionaries', 'pricing.js'), 'utf8');

  const mapBody = pricingPage.match(/const FEATURE_LABEL_KEYS = \{([\s\S]*?)\};/)?.[1] ?? '';
  const mapped = new Map(
    [...mapBody.matchAll(/([a-z_]+):\s*'([A-Za-z0-9_]+)'/g)].map((m) => [m[1], m[2]]),
  );

  for (const key of FEATURE_KEYS) {
    const labelKey = mapped.get(key);
    if (!labelKey) {
      fail(`/pricing: feature '${key}' has no FEATURE_LABEL_KEYS entry — it would render as the raw key`);
      continue;
    }
    for (const locale of ['az', 'en', 'ru']) {
      const block = pricingDict.split(`  ${locale}: {`)[1]?.split('\n  },')[0] ?? '';
      if (!block.includes(`${labelKey}:`)) {
        fail(`/pricing: '${labelKey}' (for feature '${key}') missing from pricing.js ${locale} block`);
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('PASS: entitlement precedence chain resolves correctly for all 10 checks');
