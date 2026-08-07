import { supabase, supabaseReady } from '@/lib/supabase';

const normalizeRow = (row) => (row ? { ...row, id: row.id?.toString() } : null);

// ---------------------------------------------------------------------------
// Banners (Restoran dizaynı -> Banner sistemi)
// ---------------------------------------------------------------------------
export const fetchBanners = async (restaurantId, { activeOnly = false } = {}) => {
  if (!supabaseReady) return [];
  let query = supabase.from('banners').select('*').order('sort_order', { ascending: true });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    console.error('fetchBanners error:', typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

export const createBanner = async (banner, restaurantId) => {
  if (!supabaseReady) return { banner: null, error: new Error('Supabase not ready') };
  const payload = restaurantId ? { ...banner, restaurant_id: restaurantId } : banner;
  const { data, error } = await supabase.from('banners').insert(payload).select('*').single();
  if (error) return { banner: null, error };
  return { banner: normalizeRow(data), error: null };
};

export const updateBanner = async (banner) => {
  if (!supabaseReady) return { banner: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = banner;
  const { data, error } = await supabase.from('banners').update(rest).eq('id', id).select('*').single();
  if (error) return { banner: null, error };
  return { banner: normalizeRow(data), error: null };
};

export const deleteBanner = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('banners').delete().eq('id', id);
  return { error };
};

// ---------------------------------------------------------------------------
// Campaigns (Admin -> Kampaniya)
// ---------------------------------------------------------------------------
export const fetchCampaigns = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchCampaigns error:', typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

export const createCampaign = async (campaign, restaurantId) => {
  if (!supabaseReady) return { campaign: null, error: new Error('Supabase not ready') };
  const payload = restaurantId ? { ...campaign, restaurant_id: restaurantId } : campaign;
  const { data, error } = await supabase.from('campaigns').insert(payload).select('*').single();
  if (error) return { campaign: null, error };
  return { campaign: normalizeRow(data), error: null };
};

export const updateCampaign = async (campaign) => {
  if (!supabaseReady) return { campaign: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = campaign;
  const { data, error } = await supabase.from('campaigns').update(rest).eq('id', id).select('*').single();
  if (error) return { campaign: null, error };
  return { campaign: normalizeRow(data), error: null };
};

export const deleteCampaign = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  return { error };
};

// ---------------------------------------------------------------------------
// Discounts (Endirimlər / Admin -> Endirim)
// ---------------------------------------------------------------------------
export const fetchDiscounts = async (restaurantId) => {
  if (!supabaseReady) return [];
  let query = supabase.from('discounts').select('*').order('created_at', { ascending: false });
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchDiscounts error:', typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

export const createDiscount = async (discount, restaurantId) => {
  if (!supabaseReady) return { discount: null, error: new Error('Supabase not ready') };
  const payload = restaurantId ? { ...discount, restaurant_id: restaurantId } : discount;
  const { data, error } = await supabase.from('discounts').insert(payload).select('*').single();
  if (error) return { discount: null, error };
  return { discount: normalizeRow(data), error: null };
};

export const updateDiscount = async (discount) => {
  if (!supabaseReady) return { discount: null, error: new Error('Supabase not ready') };
  const { id, ...rest } = discount;
  const { data, error } = await supabase.from('discounts').update(rest).eq('id', id).select('*').single();
  if (error) return { discount: null, error };
  return { discount: normalizeRow(data), error: null };
};

export const deleteDiscount = async (id) => {
  if (!supabaseReady) return { error: new Error('Supabase not ready') };
  const { error } = await supabase.from('discounts').delete().eq('id', id);
  return { error };
};

// Is a discount currently within its optional active window?
export const isDiscountLive = (discount) => {
  if (!discount || !discount.is_active) return false;
  const now = Date.now();
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) return false;
  if (discount.ends_at && new Date(discount.ends_at).getTime() < now) return false;
  return true;
};

// Given a product and the full discount list, return the discounted price
// (or the original price if nothing applies). Store-wide discounts
// (product_id === null) apply to every product; product-scoped discounts
// only apply to that product. If several apply, the one with the biggest
// saving wins.
export const applyDiscounts = (product, discounts) => {
  if (!product || !discounts?.length) return { price: product?.price ?? 0, discount: null };
  const price = Number(product.price) || 0;
  const applicable = discounts.filter(
    (d) => isDiscountLive(d) && (!d.product_id || d.product_id?.toString() === product.id?.toString())
  );
  if (applicable.length === 0) return { price, discount: null };

  let best = null;
  let bestPrice = price;
  applicable.forEach((d) => {
    const discounted =
      d.discount_type === 'percentage'
        ? price - (price * Number(d.value)) / 100
        : price - Number(d.value);
    const clamped = Math.max(0, discounted);
    if (clamped < bestPrice) {
      bestPrice = clamped;
      best = d;
    }
  });

  return { price: Number(bestPrice.toFixed(2)), discount: best };
};

// ---------------------------------------------------------------------------
// Audit log (Admin -> Audit Log: Kim / Nə vaxt / Nəyi dəyişib)
// ---------------------------------------------------------------------------
export const fetchAuditLogs = async (restaurantId, { limit = 100 } = {}) => {
  if (!supabaseReady) return [];
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query;
  if (error) {
    console.error('fetchAuditLogs error:', typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error);
    return [];
  }
  return (data || []).map(normalizeRow);
};

// Fire-and-forget: records "who / when / what changed". Never throws —
// audit logging should never block the admin action it's describing.
export const logAuditEvent = async ({ restaurantId, actorId, actorEmail, action, entityType, entityId, summary }) => {
  if (!supabaseReady || !restaurantId) return;
  try {
    await supabase.from('audit_logs').insert({
      restaurant_id: restaurantId,
      actor_id: actorId || null,
      actor_email: actorEmail || '',
      action,
      entity_type: entityType,
      entity_id: entityId ? entityId.toString() : '',
      summary,
    });
  } catch (error) {
    console.error('logAuditEvent error:', typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : error);
  }
};
