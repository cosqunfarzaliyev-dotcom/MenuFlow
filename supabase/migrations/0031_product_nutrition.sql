-- ============================================================================
-- MenuFlow — məhsulun qidalanma dəyəri (Nutrition Panel)
-- ============================================================================
-- Müştəri menyusunun məhsul detalı ekranı qidalanma panelini göstərir
-- (components/ProductDetailModal.jsx). İndiyə qədər orada göstəriləcək YEGANƏ
-- real sahə prep_time_minutes idi — `calories` yalnız köhnə demo seed-də
-- (data/menu.json) mövcud idi, DB-də heç vaxt sütunu olmayıb, ona görə
-- Supabase-ə bağlı hər restoranda panel praktiki olaraq boş qalırdı.
--
-- Bu miqrasiya dörd standart makro sahəsini əlavə edir. Hamısı NULL-a icazə
-- verir və default-suzdur: qidalanma məlumatı hər restoran üçün məcburi
-- deyil (əksəriyyəti bilmir və ya ölçmür), ona görə doldurulmayan sahə
-- panelə sadəcə düşmür — 0 kimi görünüb yanlış məlumat vermir.
--
-- Vahidlər QƏSDƏN sütun adına yazılıb (_g = qram): mətn sahəsi olsaydı hər
-- admin fərqli yazardı ("36g", "36 гр", "36 gram") və panel formatı pozulardı.
-- kalori tam ədəddir, makrolar numeric(6,1) — yarım qram dəqiqliyi
-- qablaşdırma etiketlərində adi haldır.
-- ============================================================================

alter table public.products
  add column if not exists calories   integer,
  add column if not exists protein_g  numeric(6,1),
  add column if not exists carbs_g    numeric(6,1),
  add column if not exists fat_g      numeric(6,1);

comment on column public.products.calories  is 'Bir porsiya üçün kalori (kkal). NULL = admin doldurmayıb, panelə düşmür.';
comment on column public.products.protein_g is 'Bir porsiya üçün protein (qram).';
comment on column public.products.carbs_g   is 'Bir porsiya üçün karbohidrat (qram).';
comment on column public.products.fat_g     is 'Bir porsiya üçün yağ (qram).';

-- Mənfi qidalanma dəyəri məna daşımır. Sıfıra icazə var (məs. 0 q yağ real
-- haldır), yalnız mənfi qiymət bloklanır. NULL check-dən keçir.
alter table public.products drop constraint if exists products_nutrition_non_negative;
alter table public.products add constraint products_nutrition_non_negative check (
  (calories  is null or calories  >= 0) and
  (protein_g is null or protein_g >= 0) and
  (carbs_g   is null or carbs_g   >= 0) and
  (fat_g     is null or fat_g     >= 0)
);

-- RLS: yeni sütun əlavə etmək mövcud siyasətlərə toxunmur — products onsuz da
-- products_public_read (`for select using (true)`, 0001) ilə oxunur və
-- personal yazma siyasəti sütun səviyyəsində deyil, sətir səviyyəsindədir.
-- Yəni burada yeni siyasət lazım deyil; get_advisors-də yeni tapıntı
-- gözlənilmir.
