-- ============================================================================
-- MenuFlow — admin-redaktə edilə bilən EN/RU tərcümələr (products/categories)
-- ============================================================================
-- lib/translations.js-dəki categoryTranslations/productTranslations demo
-- kateqoriya/məhsul id-lərinə (`pizza`, `p1`, `m1`, ...) hardcode edilib —
-- yalnız data/menu.json seed sətirlərinə uyğun gəlir. Real DB sətirlərinin
-- UUID id-ləri var, ona görə DB-dən gələn heç bir məhsul indiyə qədər
-- tərcümə olunmurdu (getLocalizedProduct/getLocalizedCategoryName həmişə AZ
-- dəyərinə düşürdü).
--
-- Sxem qərarı: ayrıca *_translations cədvəli YOX, jsonb sütunu. Səbəb:
--   - products_public_read/categories_public_read (0001) siyasətləri
--     miras alınır — yeni cədvəl yeni RLS siyasəti = yeni get_advisors
--     tapıntısı deməkdir.
--   - fetchProducts() onsuz da `.select('*')` edir (supabaseService.js) —
--     tərcümələr pulsuz gəlir, ikinci fetch/embed lazım deyil.
--   - subscribeProducts() bütöv sətir axıdır — realtime pulsuz işləyir.
--   - pos-poster-menu-sync-in UPDATE budağı tam 5 sahəni whitelist edir
--     (name/price/description/is_available/category_id) — translations
--     sütununa heç vaxt toxunulmur, POS sync ilə toqquşma yoxdur.
--   - Locale dəsti hər yerdə sabitdir (az/en/ru) — dinamik locale cədvəli
--     üstünlüyü yalnız locale-lar dəyişkən olsaydı qazanılardı.
-- ============================================================================

alter table public.products
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.categories
  add column if not exists translations jsonb not null default '{}'::jsonb;

comment on column public.products.translations is
  'İstəyə bağlı EN/RU override: {"en":{"name":"...","description":"..."},"ru":{...}}. AZ mənbəyi həmişə products.name/description-dur — burada təkrarlanmır.';

comment on column public.categories.translations is
  'İstəyə bağlı EN/RU override: {"en":{"name":"..."},"ru":{...}}. AZ mənbəyi həmişə categories.name-dir. categories-in description sütunu yoxdur, ona görə yalnız name.';

-- Səhv yazılmış locale açarı (məs. "eng") səssizcə heç vaxt render
-- olunmamasının qarşısını alır — jsonb-nin özü sxemsizdir, DB tərəfindən
-- tutulan yeganə forma qorunması budur. Subquery check constraint-də
-- işləmir (Postgres 0A000), ona görə `-` (jsonb sahə silmə) operatoru ilə:
-- 'en'/'ru' açarlarını çıxardıqdan sonra nə qalırsa, gözlənilməyən açarlardır
-- — boş qalmalıdır.
alter table public.products add constraint products_translations_shape
  check (
    jsonb_typeof(translations) = 'object'
    and (translations - 'en' - 'ru') = '{}'::jsonb
  );

alter table public.categories add constraint categories_translations_shape
  check (
    jsonb_typeof(translations) = 'object'
    and (translations - 'en' - 'ru') = '{}'::jsonb
  );
