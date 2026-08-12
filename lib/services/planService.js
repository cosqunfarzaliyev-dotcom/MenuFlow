// ---------------------------------------------------------------------------
// Plan / subscription data access — the service layer for the four
// structures added in supabase/migrations/0021_plan_subscription_system.sql:
//   Plan Definition            -> plans
//   Plan Features/Entitlements -> plan_features
//   Restaurant Subscription    -> restaurant_subscriptions
//   Restaurant Override        -> restaurant_feature_overrides
//
// This is the SINGLE source both /pricing (app/pricing/page.jsx) and the
// entitlement resolver (lib/services/entitlementService.js, via
// lib/store.js's loadPlans()) read from — fetchPlans()/fetchPlanFeatures()
// are called from exactly one place in the store and threaded to both
// consumers, so there is no second copy of "what plans exist" anywhere.
//
// WRITES, added for the SuperAdmin Plans/Subscriptions management UI
// (components/superadmin/PlansTab.jsx, RestaurantsTab.jsx's
// RestaurantSubscriptionPanel):
//   - plans / plan_features writes (createPlan/updatePlan/upsertPlanFeature)
//     land here because there is no `restaurants` column equivalent to
//     mirror them from — they're new, platform-level catalog data, and RLS
//     already lets a super_admin write these tables directly
//     (plans_super_admin_write / plan_features_super_admin_write).
//   - Changing a restaurant's PLAN, or its status to active/trialing/
//     past_due/cancelled, still goes through the EXISTING
//     superAdminService.js functions (setRestaurantPlan/markRestaurantActive/
//     markRestaurantPastDue/cancelRestaurantSubscription/extendRestaurantTrial),
//     which write restaurants.plan/subscription_status/trial_ends_at — the
//     0021 migration's sync trigger mirrors those into restaurant_subscriptions
//     automatically. This is deliberate: billingService.isAccessBlocked() and
//     every other consumer still read the `restaurants` columns, so routing
//     status/plan changes around that trigger would make this UI's view of
//     "current status" silently diverge from what actually gates access.
//   - The functions below (setSubscriptionBillingInterval/setSubscriptionAutoRenew/
//     markSubscriptionExpired/touchSubscriptionCancelledAt/renewSubscription)
//     write DIRECTLY to restaurant_subscriptions, and only for fields the
//     sync trigger never touches on its UPDATE branch (billing_interval,
//     auto_renew, renewed_at, cancelled_at) or that have no valid
//     restaurants.subscription_status value at all ('expired' — that check
//     constraint was never extended to include it). Verified against the
//     trigger body in 0021_plan_subscription_system.sql before adding these:
//     a later plan/status/trial_ends_at change on `restaurants` re-fires the
//     trigger and updates plan_id/status/start_date/end_date/trial_ends_at,
//     but never touches billing_interval/auto_renew/renewed_at/cancelled_at
//     — so a direct write here is not at risk of being silently reverted by
//     an unrelated old-path write.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';
import { markRestaurantActive } from '@/lib/services/superAdminService';

// Plan Definition ---------------------------------------------------------

// Active, sellable plans only — what /pricing shows. Legacy plans
// (free/trial/enterprise) are seeded with is_active=false specifically so
// they never appear here, matching components/superadmin/constants.js's
// PLAN_ORDER (which also excludes them from the create/edit dropdown) —
// see that file's own comment on why they're kept mapped but not offered.
export const fetchPlans = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('fetchPlans error:', error);
    return [];
  }
  return data || [];
};

// Every plan including inactive/legacy ones — powers
// components/superadmin/PlansTab.jsx's catalog view (a super_admin needs to
// see and reactivate a deactivated plan, not just the ones currently on
// /pricing).
export const fetchAllPlans = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.from('plans').select('*').order('sort_order', { ascending: true });
  if (error) {
    console.error('fetchAllPlans error:', error);
    return [];
  }
  return data || [];
};

// Plan Features / Entitlements ---------------------------------------------

// All plan_features rows (every plan, not just active ones — a restaurant
// already on a legacy plan still needs its entitlements resolved correctly).
// Kept as flat rows rather than pre-grouped here so callers can shape it
// however they need (entitlementService.hydratePlanFeatureDefaults() groups
// by plan key; /pricing groups by plan id for the feature-comparison table).
export const fetchPlanFeatures = async () => {
  if (!supabaseReady) return [];
  // Joins the plan's `key` in (not just plan_id) so a caller never needs a
  // second round-trip against `plans` to know which plan a row belongs to —
  // entitlementService.hydratePlanFeatureDefaults() needs exactly that key.
  const { data, error } = await supabase.from('plan_features').select('*, plan:plans(key)');
  if (error) {
    console.error('fetchPlanFeatures error:', error);
    return [];
  }
  return data || [];
};

// Restaurant Subscription ---------------------------------------------------

// One restaurant's current subscription row, joined with its plan so a
// caller gets the plan key/name without a second query. Read-only (see
// module header) — no updateRestaurantSubscription() here on purpose.
export const fetchRestaurantSubscription = async (restaurantId) => {
  if (!supabaseReady || !restaurantId) return null;
  const { data, error } = await supabase
    .from('restaurant_subscriptions')
    .select('*, plan:plans(*)')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) {
    console.error('fetchRestaurantSubscription error:', error);
    return null;
  }
  return data;
};

// True once the current period has definitely lapsed, whether or not
// anything has literally written status='expired' yet — same dynamic-
// detection reasoning lib/services/billingService.js's isAccessBlocked()
// already applies to restaurants.trial_ends_at. Belt and suspenders: a
// future scheduled job (none exists yet) could flip the stored status to
// 'expired' once this is true, but nothing has to wait for that job to
// exist for the check to be correct today.
export const getEffectiveSubscriptionStatus = (subscription) => {
  if (!subscription) return null;
  if (subscription.status === 'expired') return 'expired';
  if (subscription.status === 'trialing' && subscription.trial_ends_at) {
    if (new Date(subscription.trial_ends_at).getTime() < Date.now()) return 'expired';
  }
  return subscription.status;
};

// Restaurant Override ---------------------------------------------------

// Normalized form of restaurants.feature_flags — mostly useful for a future
// admin view that lists overrides as rows instead of a jsonb blob. Nothing
// in this codebase reads it yet (DesignTab/AdminApp/CustomerApp all still
// read restaurant.feature_flags via the entitlement resolver, which is the
// documented, unchanged, existing call path).
export const fetchRestaurantOverrides = async (restaurantId) => {
  if (!supabaseReady || !restaurantId) return [];
  const { data, error } = await supabase
    .from('restaurant_feature_overrides')
    .select('*')
    .eq('restaurant_id', restaurantId);
  if (error) {
    console.error('fetchRestaurantOverrides error:', error);
    return [];
  }
  return data || [];
};

// Plan Definition — writes --------------------------------------------------

export const createPlan = async ({ key, name, description, priceMonthly, priceYearly, currency, isActive, sortOrder }) => {
  if (!supabaseReady) return { plan: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase
    .from('plans')
    .insert({
      key,
      name,
      description: description || '',
      price_monthly: priceMonthly || 0,
      price_yearly: priceYearly || 0,
      currency: currency || 'AZN',
      is_active: isActive !== false,
      sort_order: sortOrder ?? 0,
    })
    .select('*')
    .single();
  if (error) {
    console.error('createPlan error:', error);
    return { plan: null, error };
  }
  return { plan: data, error: null };
};

export const updatePlan = async (plan) => {
  if (!supabaseReady) return { plan: null, error: new Error('Supabase not ready') };
  const { id, key, name, description, priceMonthly, priceYearly, currency, isActive, sortOrder } = plan;
  const payload = {};
  if (key !== undefined) payload.key = key;
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  if (priceMonthly !== undefined) payload.price_monthly = priceMonthly;
  if (priceYearly !== undefined) payload.price_yearly = priceYearly;
  if (currency !== undefined) payload.currency = currency;
  if (isActive !== undefined) payload.is_active = isActive;
  if (sortOrder !== undefined) payload.sort_order = sortOrder;
  const { data, error } = await supabase.from('plans').update(payload).eq('id', id).select('*').single();
  if (error) {
    console.error('updatePlan error:', error);
    return { plan: null, error };
  }
  return { plan: data, error: null };
};

// No deletePlan() — a plan can be referenced by restaurant_subscriptions.plan_id
// (no ON DELETE clause on that FK, so Postgres blocks the delete by default
// anyway), and every other "retire this" concept in this schema already
// uses an is_active flag rather than a hard delete (restaurants themselves,
// banners, campaigns, discounts). Deactivating (isActive: false via
// updatePlan) is the supported way to retire a plan — it drops off
// /pricing but stays resolvable for whatever restaurant still has it.

// Plan Features / Entitlements — writes --------------------------------------

// Upsert rather than update-only: a brand-new plan has zero plan_features
// rows until someone sets one, so the first toggle for any given
// (plan, feature) pair must be able to INSERT, not just UPDATE.
export const upsertPlanFeature = async ({ planId, featureKey, enabled }) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('plan_features')
    .upsert({ plan_id: planId, feature_key: featureKey, enabled }, { onConflict: 'plan_id,feature_key' });
  if (error) console.error('upsertPlanFeature error:', error);
  return { error };
};

// Restaurant Subscription — writes for fields with no restaurants-column
// equivalent (see this file's header comment for why these are the only
// direct writes to restaurant_subscriptions).

export const setSubscriptionBillingInterval = async (restaurantId, billingInterval) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('restaurant_subscriptions')
    .update({ billing_interval: billingInterval })
    .eq('restaurant_id', restaurantId);
  if (error) console.error('setSubscriptionBillingInterval error:', error);
  return { error };
};

export const setSubscriptionAutoRenew = async (restaurantId, autoRenew) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('restaurant_subscriptions')
    .update({ auto_renew: autoRenew })
    .eq('restaurant_id', restaurantId);
  if (error) console.error('setSubscriptionAutoRenew error:', error);
  return { error };
};

// 'expired' has no restaurants.subscription_status equivalent — that check
// constraint (0003_billing_self_service.sql) only ever allowed trialing/
// active/past_due/canceled, and extending it is out of scope here (it would
// mean touching a historical migration's constraint, which this project's
// convention reserves for a new migration, not a schema patch buried in a
// service-layer change). getEffectiveSubscriptionStatus() already derives
// "expired" dynamically for a trial past trial_ends_at without needing this
// at all; this exists for the super_admin to mark it explicitly (e.g. a
// past_due subscription whose grace period has definitively run out).
export const markSubscriptionExpired = async (restaurantId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('restaurant_subscriptions')
    .update({ status: 'expired' })
    .eq('restaurant_id', restaurantId);
  if (error) console.error('markSubscriptionExpired error:', error);
  return { error };
};

export const touchSubscriptionCancelledAt = async (restaurantId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('restaurant_subscriptions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('restaurant_id', restaurantId);
  if (error) console.error('touchSubscriptionCancelledAt error:', error);
  return { error };
};

// "Renew" is a combination: markRestaurantActive() (the OLD path — writes
// restaurants.subscription_status='active', which the sync trigger mirrors
// into restaurant_subscriptions.status, so isAccessBlocked() and every other
// consumer of the restaurants row sees the same "active" state this UI
// shows) plus a direct renewed_at stamp (the one field with no old-column
// equivalent for the trigger to derive it from).
export const renewSubscription = async (restaurantId) => {
  const { restaurant, error } = await markRestaurantActive(restaurantId);
  if (error) return { restaurant: null, error };
  const { error: touchError } = await supabase
    .from('restaurant_subscriptions')
    .update({ renewed_at: new Date().toISOString() })
    .eq('restaurant_id', restaurantId);
  if (touchError) console.error('renewSubscription (renewed_at) error:', touchError);
  return { restaurant, error: touchError };
};
