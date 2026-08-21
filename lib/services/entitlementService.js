// ---------------------------------------------------------------------------
// Feature entitlements — the single source of truth for "can this restaurant
// use feature X?".
//
// Before this module, every consumer read the raw jsonb column inline:
//     restaurant?.feature_flags?.banners !== false
// which spread the same (subtly wrong) default rule across CustomerApp,
// AdminApp, DesignTab and the SuperAdmin panel. Three different defaults were
// in play at once: consumers treated a MISSING key as ON, PLAN_DEFAULT_FLAGS
// seeded every key OFF for `basic`, and the SuperAdmin panel's own
// DEFAULT_FEATURE_FLAGS defaulted ON. This module collapses that into one
// documented precedence chain.
//
// SCOPE / SECURITY: every flag here is currently `enforcement: 'ui'` — it
// hides or shows UI, nothing more. This is NOT an authorization boundary. A
// customer can still call any RPC directly with the anon key; what actually
// stops them is RLS and the SECURITY DEFINER functions (see the migrations).
// When a feature needs real enforcement it gets `enforcement: 'server'` here
// AND a matching check in RLS/RPC — the consumer API below does not change.
// ---------------------------------------------------------------------------

// Canonical feature keys. Import these instead of typing raw strings, so a
// typo is a build-visible undefined rather than a silently-false feature.
export const FEATURES = {
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  BANNERS: 'banners',
  POS_INTEGRATION: 'pos_integration',
  PUSH_NOTIFICATIONS: 'push_notifications',
};

// The registry is what makes adding a feature a one-line change: consumers
// call hasFeature(restaurant, FEATURES.X) and never learn where the value
// came from.
//
// defaultEnabled is the LAST resort — used for a plan that doesn't mention
// the key, and while `restaurant` is still loading. It is deliberately `true`
// for the three launch features so that behaviour matches the old
// `!== false` reading and nothing visibly disappears.
export const FEATURE_REGISTRY = {
  [FEATURES.APPLE_PAY]: {
    label: 'Apple Pay',
    description: 'Müştəri panelində Apple Pay seçimi',
    defaultEnabled: true,
    enforcement: 'ui',
  },
  [FEATURES.GOOGLE_PAY]: {
    label: 'Google Pay',
    description: 'Müştəri panelində Google Pay seçimi',
    defaultEnabled: true,
    enforcement: 'ui',
  },
  [FEATURES.BANNERS]: {
    label: 'Banner reklamları',
    description: 'Müştəri menyusunda banner bölməsi',
    defaultEnabled: true,
    enforcement: 'ui',
  },
  // Unlike the three launch features above, there is no pre-existing
  // behaviour to preserve here — this is a brand-new premium capability
  // (0026_pos_integration.sql), so defaultEnabled is deliberately FALSE: a
  // restaurant on a plan/key this registry doesn't recognize should not
  // silently see a POS-credentials form appear.
  [FEATURES.POS_INTEGRATION]: {
    label: 'POS inteqrasiyası (Poster)',
    description: 'Menyu/qiymət Poster POS-dan sinxronlaşdırılır, sifarişlər avtomatik Poster-ə ötürülür',
    defaultEnabled: false,
    enforcement: 'ui',
  },
  // Unlike POS_INTEGRATION above, this defaults TRUE on every plan
  // (0030_push_notifications.sql) — it's core order-alerting reliability
  // (a staff device backgrounded/closed still hears about a new order), not
  // a premium upsell the way a third-party POS sync or wallet-pay UI is.
  // Locking a basic-plan restaurant out of "know when a table ordered"
  // would be a poor default, so this stays available everywhere unless a
  // future plan explicitly overrides it off.
  [FEATURES.PUSH_NOTIFICATIONS]: {
    label: 'Push bildirişlər',
    description: 'Yeni sifariş / ofisiant çağırışı / hesab tələbi üçün brauzer bildirişi',
    defaultEnabled: true,
    enforcement: 'ui',
  },
};

export const FEATURE_KEYS = Object.values(FEATURES);

// Which features a plan grants by default. This lives in the service layer,
// not in components/superadmin/constants.js, because superAdminService.js
// needs it too — a service importing from a component directory was the wrong
// dependency direction. constants.js now re-exports this for backwards
// compatibility, so existing imports keep working.
//
// Legacy plans ('free' / 'trial' / 'enterprise') are intentionally absent:
// they fall through to the registry default rather than being silently
// downgraded to Basic's feature set.
export const PLAN_FEATURE_DEFAULTS = {
  basic: {
    [FEATURES.APPLE_PAY]: false,
    [FEATURES.GOOGLE_PAY]: false,
    [FEATURES.BANNERS]: false,
    [FEATURES.POS_INTEGRATION]: false,
    [FEATURES.PUSH_NOTIFICATIONS]: true,
  },
  pro: {
    [FEATURES.APPLE_PAY]: true,
    [FEATURES.GOOGLE_PAY]: true,
    [FEATURES.BANNERS]: true,
    [FEATURES.POS_INTEGRATION]: true,
    [FEATURES.PUSH_NOTIFICATIONS]: true,
  },
};

// Kept under the old name so `import { PLAN_DEFAULT_FLAGS }` call sites
// (superAdminService.setRestaurantPlan / createRestaurant) are untouched.
export const PLAN_DEFAULT_FLAGS = PLAN_FEATURE_DEFAULTS;

// ---------------------------------------------------------------------------
// Plan Definition / Plan Features now formally exist in Postgres
// (supabase/migrations/0021_plan_subscription_system.sql: `plans` +
// `plan_features`) — this hydration function is how PLAN_FEATURE_DEFAULTS
// above adapts to that: the hardcoded object stays the INITIAL value (used
// before the DB fetch resolves, while Supabase isn't configured, or for a
// plan/key the DB rows don't cover), and lib/store.js's loadPlans() calls
// this once after fetching plan_features to overwrite it with the live DB
// values — the exact same object this whole module (hasFeature, getEntitlements)
// already reads from, mutated in place rather than reassigned, so every
// existing `import { PLAN_DEFAULT_FLAGS }` / `PLAN_FEATURE_DEFAULTS` call
// site (superAdminService.js, this file's own resolver) keeps working
// unchanged and automatically sees the hydrated values. This is deliberately
// NOT a reassignment (`PLAN_FEATURE_DEFAULTS = {...}`) — `const` bindings
// can't be reassigned, and reassigning would orphan any module that already
// captured a reference to the old object.
//
// Per-plan-key, per-feature-key merge (not a wholesale replace) so a DB
// fetch that only covers some keys for a plan doesn't blank out the rest —
// whatever the DB doesn't mention for a given plan/key keeps resolving via
// the hardcoded default, same "adapt, don't discard" principle as the rest
// of this migration.
export const hydratePlanFeatureDefaults = (planFeatureRows) => {
  if (!Array.isArray(planFeatureRows) || planFeatureRows.length === 0) return;
  for (const row of planFeatureRows) {
    const planKey = row?.plan?.key;
    if (!planKey || typeof row.feature_key !== 'string') continue;
    PLAN_FEATURE_DEFAULTS[planKey] = {
      ...(PLAN_FEATURE_DEFAULTS[planKey] || {}),
      [row.feature_key]: row.enabled === true,
    };
  }
};

/**
 * Resolve one feature for one restaurant.
 *
 * Precedence, highest first:
 *   1. Restaurant override — feature_flags[key] is strictly true/false.
 *      This is what a super admin toggles per restaurant, so it outranks the
 *      plan; that is the whole point of an override.
 *   2. Plan default        — PLAN_FEATURE_DEFAULTS[restaurant.plan][key].
 *   3. Registry default    — FEATURE_REGISTRY[key].defaultEnabled.
 *   4. false               — unknown key (not in the registry).
 *
 * A null/undefined restaurant (still loading — the customer menu resolves its
 * restaurant asynchronously) yields the registry default, so nothing flashes
 * on screen and then vanishes.
 *
 * Note on step 1: `restaurants.feature_flags` has a DB default carrying all
 * three launch keys, and every write path writes a complete object, so for
 * today's keys step 1 almost always resolves. Steps 2–4 exist for keys added
 * later, which will be absent from already-provisioned rows.
 */
export const hasFeature = (restaurant, featureKey) => {
  const spec = FEATURE_REGISTRY[featureKey];
  if (!spec) return false;
  if (!restaurant) return spec.defaultEnabled;

  const override = restaurant.feature_flags?.[featureKey];
  if (override === true || override === false) return override;

  const planDefaults = PLAN_FEATURE_DEFAULTS[restaurant.plan];
  if (planDefaults && typeof planDefaults[featureKey] === 'boolean') {
    return planDefaults[featureKey];
  }

  return spec.defaultEnabled;
};

/**
 * Every feature resolved at once: { apple_pay: bool, google_pay: bool, ... }.
 * Use when rendering a list of toggles (SuperAdmin) or when several features
 * are needed in one component, so the precedence rules are applied once.
 */
export const getEntitlements = (restaurant) =>
  FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = hasFeature(restaurant, key);
    return acc;
  }, {});

/**
 * Whether a feature key needs server-side enforcement to be meaningful.
 * Currently always false — kept so that adding an enforced feature is a
 * registry edit plus an RLS/RPC change, not a consumer refactor.
 */
export const requiresServerEnforcement = (featureKey) =>
  FEATURE_REGISTRY[featureKey]?.enforcement === 'server';
