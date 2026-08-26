-- ============================================================================
-- MenuFlow — "Sonra ödəyəcəyəm" ödəniş üsulunu restoran başına söndürülə bilən et
-- ============================================================================
-- Müştəri səbəti (components/CartDrawer.jsx) indiyə qədər BÜTÜN restoranlarda
-- eyni beş ödəniş variantını təklif edirdi və defolt seçim `later` ("Sonra
-- ödəyəcəyəm") idi. Masada oturub yeyən restoran üçün bu doğrudur — müştəri
-- yeyir, sonra hesab istəyir. Fast-food / anında ödəniş ilə işləyən restoran
-- üçün isə məntiqsizdir: müştəri sifarişi heç bir ödəniş üsulu bəyan etmədən
-- göndərir, personal isə kassada nə gözlədiyini bilmir.
--
-- Bu sütun SuperAdmin panelindən idarə olunan bir açar/qapa verir. Söndürülən
-- kimi `later` variantı müştəri menyusunda ümumiyyətlə render olunmur və
-- müştəri sifarişdən əvvəl real üsul (Nağd/Kart/wallet) seçməyə məcbur olur.
--
-- ----------------------------------------------------------------------------
-- NİYƏ feature_flags-ə YENİ AÇAR DEYİL
-- ----------------------------------------------------------------------------
-- İlk baxışda bu, Apple Pay / Google Pay kimi mövcud entitlement sisteminə
-- (lib/services/entitlementService.js) oturur. Oturmur: app/[locale]/pricing/
-- page.jsx hər plan kartını FEATURE_KEYS-in TAM siyahısı üzrə render edir, yəni
-- FEATURES-ə əlavə edilən istənilən açar avtomatik olaraq ictimai /pricing
-- səhifəsində "satılan plan xüsusiyyəti" kimi görünür (scripts/
-- verify-entitlements.mjs-in 10-cu yoxlaması bunu məcburi də edir). "Sonra
-- ödəmə" satılan bir xüsusiyyət deyil — restoranın ƏMƏLİYYAT REJİMİdir və
-- Basic/Pro fərqi ilə heç bir əlaqəsi yoxdur.
--
-- Ona görə ayrıca boolean sütun — 0043_customer_theme_colors.sql-in eyni
-- nümunəsi: sütun əlavə et -> get_public_restaurant()-a çıxar -> SuperAdmin-dən
-- idarə et.
-- ============================================================================

alter table public.restaurants
  add column if not exists pay_later_enabled boolean not null default true;

comment on column public.restaurants.pay_later_enabled is
  'Müştəri səbətində "Sonra ödəyəcəyəm" variantı təklif olunsun? false olduqda müştəri sifarişdən əvvəl real ödəniş üsulu seçməlidir (fast-food rejimi). Defolt true — mövcud restoranların davranışı dəyişmir.';

-- ----------------------------------------------------------------------------
-- Sütunu super_admin-ə məxsus et.
--
-- Gövdə canlı bazadakı tərifin eynidir (pg_get_functiondef ilə yoxlanılıb),
-- üzərinə yalnız bir sətir əlavə olunur. Bu, restoran admininin öz sətrini
-- yeniləyərkən dəyəri dəyişməsinin qarşısını BAZA SƏVİYYƏSİNDƏ alır — UI-dakı
-- sıçrayışın harada göstərilməsindən asılı olmayaraq.
-- ----------------------------------------------------------------------------
create or replace function public.protect_restaurant_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    new.slug := old.slug;
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.is_active := old.is_active;
    new.feature_flags := old.feature_flags;
    new.pay_later_enabled := old.pay_later_enabled;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_public_restaurant() — açıq sütun siyahısı genişlənir.
--
-- BU ADDIM MƏCBURİDİR: müştəri menyusu autentifikasiyasızdır və `restaurants`
-- cədvəlini birbaşa oxumur (o cədvəldə billing/PII sütunları var), yalnız bu
-- SECURITY DEFINER funksiyanın qaytardığı dar siyahını görür. Sütun buraya
-- əlavə edilməsə, SuperAdmin sıçrayışı işləyəcək, dəyər bazaya yazılacaq, amma
-- müştəri tərəfinə HEÇ VAXT çatmayacaq — 0038 və 0043 eyni səbəbdən eyni şeyi
-- etmişdi.
--
-- Siyahının qalan hissəsi 0043_customer_theme_colors.sql-dəki ilə hərfi-hərfinə
-- eynidir; yalnız feature_flags-dən sonra bir sətir artıb.
-- ----------------------------------------------------------------------------
drop function if exists public.get_public_restaurant(text);

create function public.get_public_restaurant(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  logo text,
  logo_display_mode text,
  tagline text,
  currency_symbol text,
  table_count int,
  theme_primary_color text,
  theme_secondary_color text,
  theme_background_color text,
  theme_surface_color text,
  feature_flags jsonb,
  pay_later_enabled boolean,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id, r.slug, r.name, r.logo, r.logo_display_mode, r.tagline, r.currency_symbol,
    r.table_count, r.theme_primary_color, r.theme_secondary_color,
    r.theme_background_color, r.theme_surface_color,
    r.feature_flags, r.pay_later_enabled, r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
