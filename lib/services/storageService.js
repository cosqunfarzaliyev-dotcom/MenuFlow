// ---------------------------------------------------------------------------
// Manual image upload (product/category/logo/banner) — Supabase
// Storage. supabase/migrations/0033_media_uploads.sql creates the
// `restaurant-media` bucket (public read) and its RLS policies (write gated
// by is_admin_of(), keyed off the object path's first folder segment ==
// restaurant_id). This file is the only thing in the app that talks to that
// bucket — every admin form (product/category image, restaurant logo,
// DesignTab's banners) calls
// uploadRestaurantImage and just gets back a plain public URL, written into
// the same `image`/`logo`/`image_url`/`banner_image_url` text columns a
// pasted external URL already went into. No new data shape, just a second
// way to fill it in.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';

const BUCKET = 'restaurant-media';
// Mirrors the bucket's own file_size_limit/allowed_mime_types
// (0033_media_uploads.sql / 0042_banner_video_support.sql) — checked
// client-side too so a rejected file fails fast with a clear message
// instead of a raw Storage API error.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Banner video support (0042_banner_video_support.sql). Deliberately NOT
// offered to every caller of this function — products/categories/logo stay
// image-only, so this list is only merged into the accepted-types check
// when the caller opts in via `allowVideo` (today: DesignTab's banner form
// only). Videos get a separate, larger cap: a few seconds of looping promo
// footage routinely runs well past the 5MB image limit even compressed.
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_VIDEO_FILE_SIZE = 20 * 1024 * 1024;

// folder: 'products' | 'categories' | 'logo' | 'banners' — becomes the object path's
// second segment (`{restaurantId}/{folder}/{uuid}.{ext}`), purely for
// keeping the bucket browsable in the Supabase dashboard; RLS only checks
// the first segment (restaurantId).
export const uploadRestaurantImage = async (file, { restaurantId, folder, allowVideo = false }) => {
  if (!supabaseReady) return { url: null, error: new Error('Supabase not ready') };
  if (!file) return { url: null, error: new Error('Fayl seçilməyib.') };
  if (!restaurantId) return { url: null, error: new Error('Restoran müəyyən edilmədi.') };

  const isVideo = allowVideo && ALLOWED_VIDEO_TYPES.includes(file.type);
  if (!ALLOWED_TYPES.includes(file.type) && !isVideo) {
    return {
      url: null,
      error: new Error(
        allowVideo
          ? 'Yalnız JPG, PNG, WEBP, GIF şəkil və ya MP4, WEBM, MOV video formatında fayl yükləyə bilərsiniz.'
          : 'Yalnız JPG, PNG, WEBP və ya GIF formatında şəkil yükləyə bilərsiniz.',
      ),
    };
  }
  const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    return {
      url: null,
      error: new Error(isVideo ? 'Video 20MB-dan böyük ola bilməz.' : 'Şəkil 5MB-dan böyük ola bilməz.'),
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
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
