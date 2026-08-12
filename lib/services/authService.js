import { supabase, supabaseReady } from '@/lib/supabase';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  RESTAURANT_ADMIN: 'restaurant_admin',
  STAFF: 'staff',
  UNASSIGNED: 'unassigned',
};

const normalizeProfile = (profile) => {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role || ROLES.UNASSIGNED,
    restaurantId: profile.restaurant_id || null,
    // Added in migration 0023 — the per-user language preference. Defaults
    // to 'az' at the DB layer already, but guard here too in case a row
    // predates a schema-cache refresh.
    locale: profile.locale || 'az',
  };
};

// Fetches the profile (role + restaurant) for the currently signed-in user.
// Returns null if nobody is signed in or Supabase isn't configured.
export const fetchMyProfile = async () => {
  if (!supabaseReady) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    console.error('fetchMyProfile error:', error);
    return null;
  }
  return normalizeProfile(data);
};

// Persists the caller's own language choice server-side (migration 0023) so
// it follows them across devices/browsers. `profiles` UPDATE is
// super-admin-only (0003) — a plain client update would fail closed — so
// this goes through the update_my_locale() SECURITY DEFINER RPC, which only
// ever touches the caller's own `locale` column (see the migration's header
// comment for why that's safe). Best-effort by design: called after the
// local language store already updated, so a network hiccup here never
// blocks the UI from switching language — it just means the next
// cross-device sync is delayed until the next successful call.
export const updateMyLocale = async (locale) => {
  if (!supabaseReady) return false;
  const { error } = await supabase.rpc('update_my_locale', { p_locale: locale });
  if (error) {
    console.error('updateMyLocale error:', error);
    return false;
  }
  return true;
};

export const fetchRestaurantBySlug = async (slug) => {
  if (!supabaseReady || !slug) return null;
  // Unauthenticated (customer QR menu) context — reads the safe, public
  // column subset only, via a SECURITY DEFINER RPC rather than a view (see
  // supabase/migrations/0020_security_audit_hardening.sql — replaced the
  // original restaurants_public VIEW from 0007_restaurant_privacy_hardening.sql,
  // which the Supabase security advisor flags as an ERROR-level
  // `security_definer_view` finding: a bare view bypassing RLS has no
  // code-level statement of which columns are safe to expose if it's ever
  // carelessly widened later; a function's explicit column list is the same
  // narrow projection without that footgun). is_active filtering now happens
  // inside the function itself. Never query the base `restaurants` table
  // here: it no longer allows anonymous reads, and even if it did, it
  // carries billing/PII columns (plan, subscription_status, trial_ends_at)
  // this context has no business seeing.
  const { data, error } = await supabase
    .rpc('get_public_restaurant', { p_slug: slug })
    .single();
  if (error) {
    console.error('fetchRestaurantBySlug error:', error);
    return null;
  }
  return data;
};

export const fetchRestaurantById = async (id) => {
  if (!supabaseReady || !id) return null;
  // Authenticated admin/staff context — reads the full row (billing fields
  // included), gated by the restaurants_staff_read RLS policy.
  const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
  if (error) {
    console.error('fetchRestaurantById error:', error);
    return null;
  }
  return data;
};
