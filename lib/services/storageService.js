// ---------------------------------------------------------------------------
// Manual image upload (product/category/logo/banner/campaign) — Supabase
// Storage. supabase/migrations/0033_media_uploads.sql creates the
// `restaurant-media` bucket (public read) and its RLS policies (write gated
// by is_admin_of(), keyed off the object path's first folder segment ==
// restaurant_id). This file is the only thing in the app that talks to that
// bucket — every admin form (product/category image, restaurant logo,
// DesignTab's banners, PromotionsTab's campaigns) calls
// uploadRestaurantImage and just gets back a plain public URL, written into
// the same `image`/`logo`/`image_url`/`banner_image_url` text columns a
// pasted external URL already went into. No new data shape, just a second
// way to fill it in.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';

const BUCKET = 'restaurant-media';
// Mirrors the bucket's own file_size_limit/allowed_mime_types
// (0033_media_uploads.sql) — checked client-side too so a rejected file
// fails fast with a clear message instead of a raw Storage API error.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// folder: 'products' | 'categories' | 'logo' | 'banners' | 'campaigns' — becomes the object path's
// second segment (`{restaurantId}/{folder}/{uuid}.{ext}`), purely for
// keeping the bucket browsable in the Supabase dashboard; RLS only checks
// the first segment (restaurantId).
export const uploadRestaurantImage = async (file, { restaurantId, folder }) => {
  if (!supabaseReady) return { url: null, error: new Error('Supabase not ready') };
  if (!file) return { url: null, error: new Error('Fayl seçilməyib.') };
  if (!restaurantId) return { url: null, error: new Error('Restoran müəyyən edilmədi.') };
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: new Error('Yalnız JPG, PNG, WEBP və ya GIF formatında şəkil yükləyə bilərsiniz.') };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: new Error('Şəkil 5MB-dan böyük ola bilməz.') };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${restaurantId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) {
    console.error('uploadRestaurantImage error:', uploadError);
    return { url: null, error: uploadError };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
};
