import { supabase, supabaseReady } from '@/lib/supabase';

// Calls the create_restaurant_self_service Postgres function (see
// supabase/migrations/0003_billing_self_service.sql). Runs as SECURITY
// DEFINER on the server: creates the restaurant, its default tables, and
// promotes the calling user to restaurant_admin of it, all in one
// transaction — a plain client-side insert can't do this because RLS only
// lets a super_admin write to restaurants/profiles.
export const createRestaurantSelfService = async ({ slug, name, tagline, currencySymbol, tableCount }) => {
  if (!supabaseReady) return { restaurant: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase.rpc('create_restaurant_self_service', {
    p_slug: slug,
    p_name: name,
    p_tagline: tagline || '',
    p_currency_symbol: currencySymbol || '₼',
    p_table_count: tableCount || 20,
  });
  if (error) {
    console.error('createRestaurantSelfService error:', error);
    return { restaurant: null, error };
  }
  return { restaurant: data, error: null };
};

export const TRIAL_LENGTH_DAYS = 14;

export const getTrialDaysLeft = (restaurant) => {
  if (!restaurant?.trial_ends_at) return null;
  const diffMs = new Date(restaurant.trial_ends_at).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// True once a restaurant should be blocked from using the admin panel:
// trial expired without upgrading, or subscription lapsed.
export const isAccessBlocked = (restaurant) => {
  if (!restaurant) return false;
  if (restaurant.subscription_status === 'active') return false;
  if (restaurant.subscription_status === 'trialing') {
    const daysLeft = getTrialDaysLeft(restaurant);
    return daysLeft !== null && daysLeft < 0;
  }
  // 'past_due' / 'canceled'
  return true;
};
