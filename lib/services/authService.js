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

export const fetchRestaurantBySlug = async (slug) => {
  if (!supabaseReady || !slug) return null;
  // Unauthenticated (customer QR menu) context — reads the safe, public
  // column subset only (see supabase/migrations/0007_restaurant_privacy_hardening.sql).
  // Never query the base `restaurants` table here: it no longer allows
  // anonymous reads, and even if it did, it carries billing/PII columns
  // (plan, subscription_status, trial_ends_at) this context has no business seeing.
  const { data, error } = await supabase
    .from('restaurants_public')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
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
