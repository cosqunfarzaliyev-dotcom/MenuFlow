-- ============================================================================
-- MenuFlow — Banner video dəstəyi
-- ============================================================================
-- Banner sistemi (Dizayn -> Banner sistemi) indiyə qədər yalnız statik şəkil
-- qəbul edirdi. Bu miqrasiya `restaurant-media` bucket-inin server tərəfli
-- icazələrini genişləndirir ki, bir admin banner üçün qısa bir loop video da
-- yükləyə bilsin (məs. yeməyin hazırlanma prosesi, restoran atmosferi).
--
-- Client tərəfli yoxlama (lib/services/storageService.js) artıq bunu
-- `allowVideo` bayrağı ilə dəstəkləyir, amma Supabase Storage bucket-i öz
-- `allowed_mime_types`/`file_size_limit` sütunları ilə SERVER tərəfdə də
-- eyni siyahını tətbiq edir (0033_media_uploads.sql) — client-side yoxlama
-- təkcə sürətli/aydın xəta üçündür, real qapı budur. Ona görə hər iki
-- tərəfi sinxron saxlamaq lazımdır.
--
-- `file_size_limit` 20MB-a qaldırılır (əvvəl 5MB idi) — bu, TƏK bucket
-- bütün qovluqlar (products/categories/logo/banners) üçün paylaşılan
-- limitdir, ayrıca qovluq bazlı limit Supabase Storage-də mövcud deyil.
-- Bu, şəkillərin də server tərəfdə 20MB-a qədər yüklənə bilməsi deməkdir,
-- amma client (storageService.js) şəkillər üçün öz 5MB məhdudiyyətini
-- saxlayır — server limiti həmişə client limitindən böyük və ya bərabər
-- olmalıdır, əks halda video üçün "icazəlidir" deyən client mesajı real
-- upload zamanı Storage API-nin öz xətası ilə ziddiyyət təşkil edərdi.
-- ============================================================================
update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
where id = 'restaurant-media';
