import { supabase, supabaseReady } from '@/lib/supabase';

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

export const createRestaurant = async ({ slug, name, tagline, currencySymbol, tableCount }) => {
  if (!supabaseReady) return { restaurant: null, error: new Error('Supabase not ready') };
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      slug,
      name,
      tagline: tagline || '',
      currency_symbol: currencySymbol || '₼',
      table_count: tableCount || 20,
      is_active: true,
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
    id, slug, name, tagline, currencySymbol, logo, is_active, plan, subscription_status, trial_ends_at,
    tableCount, themePrimaryColor, themeSecondaryColor,
  } = restaurant;
  const payload = {};
  if (slug !== undefined) payload.slug = slug;
  if (name !== undefined) payload.name = name;
  if (tagline !== undefined) payload.tagline = tagline;
  if (currencySymbol !== undefined) payload.currency_symbol = currencySymbol;
  if (logo !== undefined) payload.logo = logo;
  if (is_active !== undefined) payload.is_active = is_active;
  if (plan !== undefined) payload.plan = plan;
  if (subscription_status !== undefined) payload.subscription_status = subscription_status;
  if (trial_ends_at !== undefined) payload.trial_ends_at = trial_ends_at;
  if (tableCount !== undefined) payload.table_count = tableCount;
  // Theme Builder (restaurant design -> restaurant picks its own colors)
  if (themePrimaryColor !== undefined) payload.theme_primary_color = themePrimaryColor;
  if (themeSecondaryColor !== undefined) payload.theme_secondary_color = themeSecondaryColor;

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
export const extendRestaurantTrial = async (id, days = 14) => {
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return updateRestaurant({ id, subscription_status: 'trialing', trial_ends_at: trialEndsAt });
};

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

export const assignUserToRestaurant = async ({ email, restaurantId, role }) => {
  if (!supabaseReady) return { profile: null, error: new Error('Supabase not ready') };
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('assignUserToRestaurant lookup error:', lookupError);
    return { profile: null, error: lookupError };
  }
  if (!existing) {
    return {
      profile: null,
      error: new Error('Bu email ilə qeydiyyatdan keçmiş istifadəçi tapılmadı. İstifadəçi əvvəlcə /login səhifəsində "Qeydiyyatdan keçin" ilə hesab yaratmalıdır.'),
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role, restaurant_id: restaurantId })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) {
    console.error('assignUserToRestaurant update error:', error);
    return { profile: null, error };
  }
  return { profile: data, error: null };
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
