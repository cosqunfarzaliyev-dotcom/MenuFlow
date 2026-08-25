import { supabase, supabaseReady } from '@/lib/supabase';
import { TRIAL_LENGTH_DAYS } from '@/lib/services/billingService';
// Sourced from the service layer rather than components/superadmin/constants
// (which now just re-exports these) so a service no longer depends on a
// component directory.
import { PLAN_DEFAULT_FLAGS } from '@/lib/services/entitlementService';

const normalizeRestaurant = (r) => (r ? { ...r, id: r.id?.toString() } : null);

const createDefaultTablesForRestaurant = async (restaurantId, count) => {
  const rows = Array.from({ length: count }, (_, i) => ({
    restaurant_id: restaurantId,
    table_number: i + 1,
    name: `Masa ${i + 1}`,
  }));
  const { error } = await supabase.from('restaurant_tables').insert(rows);
  if (error) console.error('createDefaultTablesForRestaurant error:', error);
};

// Restaurants (tenants) --------------------------------------------------

export const fetchRestaurants = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('fetchRestaurants error:', error);
    return [];
  }
  return (data || []).map(normalizeRestaurant);
};

// Aggregates order count / revenue per restaurant in one pass so the
// dashboard doesn't need N+1 queries.
export const fetchRestaurantStats = async () => {
  if (!supabaseReady) return {};
  const { data, error } = await supabase.from('orders').select('restaurant_id, total, status');
  if (error) {
    console.error('fetchRestaurantStats error:', error);
    return {};
  }
  const stats = {};
  for (const row of data || []) {
    const key = row.restaurant_id;
    if (!key) continue;
    if (!stats[key]) stats[key] = { orderCount: 0, revenue: 0 };
    stats[key].orderCount += 1;
    if (row.status !== 'cancelled') stats[key].revenue += Number(row.total) || 0;
  }
  return stats;
};

export const createRestaurant = async ({ slug, name, tagline, currencySymbol, tableCount, plan }) => {
  if (!supabaseReady) return { restaurant: null, error: new Error('Supabase not ready') };
  const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      slug,
      name,
      tagline: tagline || '',
      currency_symbol: currencySymbol || '₼',
      table_count: tableCount || 20,
      is_active: true,
      plan: plan || 'basic',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      feature_flags: PLAN_DEFAULT_FLAGS[plan] || PLAN_DEFAULT_FLAGS.basic,
    })
    .select('*')
    .single();
  if (error) {
    console.error('createRestaurant error:', error);
    return { restaurant: null, error };
  }
  await createDefaultTablesForRestaurant(data.id, tableCount || 20);
  return { restaurant: normalizeRestaurant(data), error: null };
};

export const updateRestaurant = async (restaurant) => {
  if (!supabaseReady) return { restaurant: null, error: new Error('Supabase not ready') };
  const {
    id, slug, name, tagline, currencySymbol, logo, logoDisplayMode, is_active, plan, subscription_status, trial_ends_at,
    tableCount, themePrimaryColor, themeSecondaryColor, themeBackgroundColor, themeSurfaceColor, feature_flags,
    phone, address, onboardingCompletedAt,
  } = restaurant;
  const payload = {};
  if (slug !== undefined) payload.slug = slug;
  if (name !== undefined) payload.name = name;
  if (tagline !== undefined) payload.tagline = tagline;
  if (currencySymbol !== undefined) payload.currency_symbol = currencySymbol;
  if (logo !== undefined) payload.logo = logo;
  // 0035_restaurant_logo_display_mode.sql — 'name' | 'logo', lets the
  // customer menu header show the full logo instead of the restaurant name.
  if (logoDisplayMode !== undefined) payload.logo_display_mode = logoDisplayMode;
  if (is_active !== undefined) payload.is_active = is_active;
  if (plan !== undefined) payload.plan = plan;
  if (subscription_status !== undefined) payload.subscription_status = subscription_status;
  if (trial_ends_at !== undefined) payload.trial_ends_at = trial_ends_at;
  if (feature_flags !== undefined) payload.feature_flags = feature_flags;
  if (tableCount !== undefined) payload.table_count = tableCount;
  // Theme Builder (restaurant design -> restaurant picks its own colors).
  // Four columns as of 0043: accent, text (themeSecondaryColor — repurposed,
  // it fed a --theme-secondary variable nothing read before that migration),
  // page background and card surface.
  if (themePrimaryColor !== undefined) payload.theme_primary_color = themePrimaryColor;
  if (themeSecondaryColor !== undefined) payload.theme_secondary_color = themeSecondaryColor;
  if (themeBackgroundColor !== undefined) payload.theme_background_color = themeBackgroundColor;
  if (themeSurfaceColor !== undefined) payload.theme_surface_color = themeSurfaceColor;
  // Onboarding wizard fields (migration 0024) — contact info + the
  // completion timestamp middleware.js gates /admin and /onboarding on.
  // Not privileged columns (see the migration header): a restaurant_admin
  // sets these on their own row, same as name/tagline/logo above.
  if (phone !== undefined) payload.phone = phone;
  if (address !== undefined) payload.address = address;
  if (onboardingCompletedAt !== undefined) payload.onboarding_completed_at = onboardingCompletedAt;

  const { data, error } = await supabase.from('restaurants').update(payload).eq('id', id).select('*').single();
  if (error) {
    console.error('updateRestaurant error:', error);
    return { restaurant: null, error };
  }
  return { restaurant: normalizeRestaurant(data), error: null };
};

// Manual billing actions (no payment gateway wired up yet — see the
// "Abunəlik" card in SuperAdminApp for where a real Payriff/Stripe
// integration would call these same functions from a webhook instead).
export const markRestaurantActive = async (id) => updateRestaurant({ id, subscription_status: 'active' });
export const markRestaurantPastDue = async (id) => updateRestaurant({ id, subscription_status: 'past_due' });
export const cancelRestaurantSubscription = async (id) => updateRestaurant({ id, subscription_status: 'canceled' });
export const extendRestaurantTrial = async (id, days = TRIAL_LENGTH_DAYS) => {
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return updateRestaurant({ id, subscription_status: 'trialing', trial_ends_at: trialEndsAt });
};

// Restaurant Aktiv (master) switch — freezes/unfreezes the whole tenant
// (public menu + admin/staff panel access). See lib/services/billingService.js
// isAccessBlocked(), which every panel checks against this flag.
export const setRestaurantActiveState = async (id, isActive) => updateRestaurant({ id, is_active: isActive });

// Resizes an EXISTING restaurant's table_count — the gap SettingsTab.jsx's
// now-removed admin-facing field left behind: that field wrote
// restaurants.table_count but never touched a single restaurant_tables
// row, so it silently drifted from reality the moment anyone changed it.
// This is the real thing, callable only from here (RestaurantModal's edit
// mode).
//
// Growing: appends new rows exactly like createDefaultTablesForRestaurant
// does at creation (table_number = current max + 1 .. newCount).
// Shrinking: removes the highest-numbered rows down to newCount — but
// orders.table_id / alerts.table_id are ON DELETE SET NULL, not RESTRICT
// (0001/0011), so a naive delete would silently orphan historical orders
// from their table instead of failing loudly. Checked explicitly here: any
// table slated for removal that has order/alert history blocks the WHOLE
// resize with a clear error, rather than deleting the safe ones and
// leaving table_count out of sync with what's actually there.
//
// Caller is expected to only invoke this when the count actually changed —
// it still no-ops correctly if not, but skipping the call avoids a wasted
// round trip on every save.
export const resizeRestaurantTables = async (restaurantId, newCount) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const safeCount = Math.max(1, Math.min(200, parseInt(newCount, 10) || 1));

  const { data: tables, error: fetchError } = await supabase
    .from('restaurant_tables')
    .select('id, table_number')
    .eq('restaurant_id', restaurantId)
    .order('table_number', { ascending: true });
  if (fetchError) {
    console.error('resizeRestaurantTables fetch error:', fetchError);
    return { error: fetchError };
  }

  const currentCount = tables.length;
  if (safeCount === currentCount) return { error: null };

  if (safeCount > currentCount) {
    const rows = Array.from({ length: safeCount - currentCount }, (_, i) => ({
      restaurant_id: restaurantId,
      table_number: currentCount + i + 1,
      name: `Masa ${currentCount + i + 1}`,
    }));
    const { error } = await supabase.from('restaurant_tables').insert(rows);
    if (error) console.error('resizeRestaurantTables insert error:', error);
    return { error: error || null };
  }

  const toRemove = tables.filter((tbl) => tbl.table_number > safeCount);
  const idsToRemove = toRemove.map((tbl) => tbl.id);

  const [{ count: orderCount, error: orderErr }, { count: alertCount, error: alertErr }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('table_id', idsToRemove),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).in('table_id', idsToRemove),
  ]);
  if (orderErr) return { error: orderErr };
  if (alertErr) return { error: alertErr };
  if ((orderCount || 0) > 0 || (alertCount || 0) > 0) {
    return {
      error: new Error(
        `Masa sayını ${safeCount}-ə endirmək olmur — silinəcək masalarda (${safeCount + 1}–${currentCount}) sifariş/çağırış tarixçəsi var.`
      ),
    };
  }

  const { error: deleteError } = await supabase.from('restaurant_tables').delete().in('id', idsToRemove);
  if (deleteError) console.error('resizeRestaurantTables delete error:', deleteError);
  return { error: deleteError || null };
};

// Individual feature switches (Apple Pay / Google Pay / Banners). Merges
// into the existing feature_flags object rather than replacing it, so
// toggling one switch never clobbers the others.
export const setRestaurantFeatureFlag = async (restaurant, flagKey, value) => {
  const nextFlags = { ...(restaurant.feature_flags || {}), [flagKey]: value };
  return updateRestaurant({ id: restaurant.id, feature_flags: nextFlags });
};

// Changing plan resets feature flags to that plan's defaults (Pro turns
// everything on, Basic turns it off) — SuperAdmin can still flip individual
// switches afterwards to override for a specific restaurant.
export const setRestaurantPlan = async (id, plan) => updateRestaurant({
  id,
  plan,
  feature_flags: PLAN_DEFAULT_FLAGS[plan] || PLAN_DEFAULT_FLAGS.basic,
});

export const deleteRestaurant = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('restaurants').delete().eq('id', id);
  if (error) console.error('deleteRestaurant error:', error);
  return { error };
};

// Admin / staff user assignment ------------------------------------------

// Every signed-up user automatically gets a `profiles` row (role:
// 'unassigned') via a DB trigger. A super_admin assigns them to a
// restaurant by looking their profile up by email — no service-role key
// needed, since this only ever updates role/restaurant_id on an existing row.
export const fetchProfilesForRestaurant = async (restaurantId) => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('role', ['restaurant_admin', 'staff']);
  if (error) {
    console.error('fetchProfilesForRestaurant error:', error);
    return [];
  }
  return data || [];
};

// Creates the user's auth account (if they don't have one yet) AND attaches
// their profile to a restaurant, in one call — the single path for onboarding a
// restaurant_admin now that public sign-up is gone.
//
// This is the ONLY place in the app that talks to a backend. It has to be:
// creating an `auth.users` row needs the service-role key, which can never ship
// to a browser, and `profiles.id` has a hard FK to `auth.users(id)` so a
// profile can't be pre-created for someone who hasn't signed up. See
// supabase/functions/create-restaurant-user/index.ts for the function itself
// (including why it re-verifies super_admin from the caller's own JWT rather
// than trusting this call site).
//
// It replaced an older `assignUserToRestaurant()` that could only UPDATE an
// already-existing profile row — which meant the super admin first had to tell
// the new admin to go self-register at /login. That form no longer exists, so
// that function had no working path left; this one covers both its job
// (attaching an existing unassigned profile — pass no password) and creating
// the account outright.
export const createOrAssignRestaurantUser = async ({ restaurantId, email, password, role = 'restaurant_admin' }) => {
  if (!supabaseReady) return { profile: null, error: new Error('Supabase not ready') };

  const { data, error } = await supabase.functions.invoke('create-restaurant-user', {
    body: { restaurantId, email, password: password || undefined, role },
  });

  if (error) {
    // functions.invoke() throws a FunctionsHttpError on any non-2xx and
    // DISCARDS the response body from `error.message` — which would leave the
    // super admin staring at "Edge Function returned a non-2xx status code"
    // instead of "this email already belongs to another restaurant". The real
    // payload is only reachable through error.context (a Response object), so
    // unwrap it here rather than in every call site.
    let message = error.message;
    let code = null;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.message) message = parsed.message;
      if (parsed?.code) code = parsed.code;
    } catch {
      // Non-JSON body (gateway-level failure, network error) — keep the
      // original message rather than masking the failure entirely.
    }
    console.error('createOrAssignRestaurantUser error:', code, message);
    const wrapped = new Error(message);
    wrapped.code = code;
    return { profile: null, error: wrapped };
  }

  return { profile: data?.profile || null, created: data?.created ?? null, error: null };
};

export const removeUserFromRestaurant = async (profileId) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'unassigned', restaurant_id: null })
    .eq('id', profileId);
  if (error) console.error('removeUserFromRestaurant error:', error);
  return { error };
};

// Platform-wide user directory (all admins/staff/super_admins across every
// restaurant, with real last-login timestamps from auth.users) — powers the
// User Management tab. See migrations/0005_super_admin_user_directory.sql.
export const fetchPlatformUsers = async () => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase.rpc('get_platform_users');
  if (error) {
    console.error('fetchPlatformUsers error:', error);
    return [];
  }
  return data || [];
};
