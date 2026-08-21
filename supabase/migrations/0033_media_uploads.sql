-- ============================================================================
-- MenuFlow — restoran media yükləmələri (məhsul/kateqoriya/loqo şəkilləri)
-- ============================================================================
-- İndiyə qədər admin panelində məhsul, kateqoriya və restoran loqosu üçün
-- şəkil sahəsi sadəcə mətn sahəsi idi — admin xarici bir linki əl ilə
-- yapışdırmalı idi, faylı birbaşa yükləmək mümkün deyildi. Bu miqrasiya
-- manual fayl yükləməni mümkün edən Supabase Storage bucket-ini və onun RLS
-- siyasətlərini yaradır; həqiqi yükləmə kodu lib/services/storageService.js-
-- dədir, admin panelindəki üç forma (məhsul, kateqoriya, restoran ayarları)
-- onu çağırır.
--
-- YOL QAYDASI: hər obyekt `{restaurant_id}/{folder}/{fayl}` şəklində
-- saxlanılır (folder: products|categories|logo) — RLS bu prefiksə görə yazma
-- icazəsini yoxlayır, is_admin_of() ilə (0026_pos_integration.sql-də təyin
-- edilib) — yalnız o restoranın admini (və ya super admin) öz qovluğuna
-- yaza bilər. Oxuma (SELECT) hamı üçün açıqdır: bu şəkillər müştəri
-- menyusunda (unauthenticated) göstərilməlidir, elə bir açıq bucket kimi
-- yaradılıb ki, public URL birbaşa <img>/next/image-də işləsin.
-- ============================================================================

-- 1. categories.image — kateqoriyanın öz şəkli, emoji `icon` sahəsindən
-- ayrı, əlavə bir vizual sahə. `icon` dot-leader siyahıda qalır (dəyişməz),
-- `image` isə kateqoriya kartı/başlığı üçün istifadə oluna bilər.
alter table public.categories
  add column if not exists image text default '';

comment on column public.categories.image is 'Kateqoriyanın şəkli (Supabase Storage public URL və ya xarici link). Boş sətir = şəkil yoxdur.';

-- 2. Storage bucket — bir bucket, üç qovluq (products/categories/logo),
-- restaurant_id ilə prefikslənib. 5MB limit + yalnız şəkil MIME növləri:
-- restoran media faylları üçün kifayət qədər səxavətli, amma bucket-i
-- özbaşına böyük fayllarla doldurmağın qarşısını alır.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-media',
  'restaurant-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 3. RLS — storage.objects üzərində, bucket_id-yə görə filtrlənib (bu
-- cədvəl bütün bucket-lər üçün paylaşılır, ona görə hər siyasət öz
-- bucket-ini yoxlamalıdır ki, başqa bucket-lərə təsir etməsin).
drop policy if exists "restaurant_media_public_read" on storage.objects;
create policy "restaurant_media_public_read"
  on storage.objects for select
  using (bucket_id = 'restaurant-media');

drop policy if exists "restaurant_media_admin_insert" on storage.objects;
create policy "restaurant_media_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-media'
    and public.is_admin_of(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "restaurant_media_admin_update" on storage.objects;
create policy "restaurant_media_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'restaurant-media'
    and public.is_admin_of(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "restaurant_media_admin_delete" on storage.objects;
create policy "restaurant_media_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-media'
    and public.is_admin_of(((storage.foldername(name))[1])::uuid)
  );
