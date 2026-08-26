-- ============================================================================
-- MenuFlow — Restoranın iş modeli (service model)
-- ============================================================================
-- Bütün restoranlar eyni sxemlə işləmir. Üç real nümunə var:
--
--   waiter_pay_later  Ofisiantlı, sonra ödəmə. Müştəri oturur, yeyir, sonra
--                     hesab istəyir. 0045-ə qədər YEGANƏ mümkün davranış.
--   waiter_prepay     Ofisiantlı, amma ödəniş üsulu sifariş anında bəyan olunur.
--   self_service      Ofisiant YOXDUR. Müştəri sifariş verir, ödəyir və mətbəx
--                     hazır işarələyəndə sifarişi özü kassadan götürür.
--
-- ----------------------------------------------------------------------------
-- pay_later_enabled NİYƏ SİLİNİR
-- ----------------------------------------------------------------------------
-- 0044 həmin sütunu məhz 2-ci sxemin yarısı üçün əlavə etmişdi. İş modeli onu
-- TAM əhatə edir: waiter_pay_later -> sonra ödəmə açıq, digər ikisi -> bağlı.
-- İkisini yan-yana saxlamaq SuperAdmin-ə ziddiyyətli vəziyyət qurmağa imkan
-- verərdi ("Özünəxidmət" + "Sonra ödəmə açıq" kimi mənasız kombinasiya), ona
-- görə dəyər köçürülür və sütun silinir. Heç bir niyyət itmir.
--
-- ----------------------------------------------------------------------------
-- MASA QR-I ÖZÜNƏXİDMƏTDƏ DƏ QALIR
-- ----------------------------------------------------------------------------
-- Bu, şüurlu məhsul qərarıdır. place_order(), upsert_alert() və
-- get_table_orders() — ÜÇÜ DƏ table_id + imzalı QR token tələb edir
-- (0008_qr_token_verification.sql). Tək bir "kassa QR-ı" modeli seçilsəydi,
-- bütün müştərilər eyni masa sətrini paylaşardı və bir-birinin sifarişini
-- görərdi. Özünəxidmətdə də müştəri masasındakı QR-ı oxudur; dəyişən yalnız
-- sifarişi kimin gətirməsidir.
-- ============================================================================

alter table public.restaurants
  add column if not exists service_model text not null default 'waiter_pay_later';

-- Ayrıca əlavə olunur (add column-un içində deyil) ki, miqrasiya təkrar
-- işlədilsə `if not exists` qorunsun.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurants'::regclass and conname = 'restaurants_service_model_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_service_model_check
      check (service_model in ('waiter_pay_later', 'waiter_prepay', 'self_service'));
  end if;
end $$;

comment on column public.restaurants.service_model is
  'Restoranın iş sxemi: waiter_pay_later (ofisiantlı, sonra ödəmə) | waiter_prepay (ofisiantlı, öncədən ödəmə) | self_service (ofisiantsız, müştəri sifarişini özü götürür). Qayda cədvəli lib/services/serviceModelService.js-dədir — davranış qərarları yalnız oradan oxunur.';

-- 0044-ün pay_later_enabled dəyərini köçür, sonra sütunu sil.
-- drop column-dan ƏVVƏL olmalıdır, əks halda köçürüləcək məlumat qalmaz.
update public.restaurants
set service_model = case when pay_later_enabled then 'waiter_pay_later' else 'waiter_prepay' end;

alter table public.restaurants drop column if exists pay_later_enabled;

-- ----------------------------------------------------------------------------
-- Sütunu super_admin-ə məxsus et.
--
-- Gövdə 0044-dəki ilə eynidir, yalnız pay_later_enabled sətri service_model ilə
-- ƏVƏZ olunub (köhnə sətir qalsaydı, artıq mövcud olmayan sütuna müraciətdən
-- trigger hər UPDATE-də partlayardı).
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
    new.service_model := old.service_model;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_public_restaurant() — açıq sütun siyahısı yenilənir.
--
-- MƏCBURİDİR: müştəri menyusu autentifikasiyasızdır və `restaurants` cədvəlini
-- birbaşa oxumur, yalnız bu SECURITY DEFINER funksiyanın qaytardığı dar siyahını
-- görür. Siyahı əl ilə saxlanılır — service_model bura yazılmasa, SuperAdmin
-- seçimi bazaya düşəcək, amma müştəri tərəfinə HEÇ VAXT çatmayacaq (0038, 0043
-- və 0044 eyni səbəbdən eyni əməliyyatı etmişdi).
--
-- 0044-dəki siyahı ilə fərq: pay_later_enabled çıxıb, service_model gəlib.
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
  service_model text,
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
    r.feature_flags, r.service_model, r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
