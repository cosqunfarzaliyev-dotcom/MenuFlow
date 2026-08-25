-- ============================================================================
-- MenuFlow — Müştəri menyusunun rəng fərdiləşdirilməsi
-- ============================================================================
-- İndiyə qədər restoran sahibi müştəri QR menyusunda YALNIZ bir rəngi
-- (theme_primary_color) dəyişə bilirdi, o da yalnız düymə/vurğu rənginə təsir
-- edirdi. Fon, mətn və kart rəngləri components/kit/tokens.css-dəki .kit-light
-- blokunda sabit kodlanmışdı, yəni menyu hər restoranda eyni ağ-boz görünürdü.
--
-- Bu miqrasiya həmin dörd rəngi bazaya çıxarır:
--   theme_primary_color     (mövcud)  -> düymə / vurğu
--   theme_secondary_color   (YENİDƏN TƏYİNATLI) -> mətn rəngi
--   theme_background_color  (yeni)    -> səhifə fonu
--   theme_surface_color     (yeni)    -> kart / panel
--
-- ----------------------------------------------------------------------------
-- theme_secondary_color NİYƏ YENİDƏN TƏYİNATLANIR
-- ----------------------------------------------------------------------------
-- Bu sütun 0006_admin_feature_pack.sql-dən bəri mövcuddur və admin panelində
-- "İkinci rəng" adlı canlı bir rəng seçicisi ilə redaktə olunurdu — lakin
-- CustomerApp.jsx onu --theme-secondary kimi təyin etsə də, bütün repoda o
-- dəyişənin SIFIR istehlakçısı var idi. Yəni sahib illərdir heç nəyə təsir
-- etməyən bir seçici ilə oynayırdı. Yeni sütun açmaq əvəzinə ona real iş
-- veririk; susma dəyəri (#14151A) onsuz da mətn rənginə (#18181B) çox yaxındır.
--
-- MÖVCUD DƏYƏRLƏR SIFIRLANIR: sütun heç vaxt render olunmadığı üçün oradakı
-- dəyərlər heç bir sahibin şüurlu qərarı DEYİL (məs. bir restoranda #7e3da9 —
-- bənövşəyi). Sıfırlamasaq, bu miqrasiyadan sonra həmin restoranın bütün menyu
-- mətni birdən bənövşəyi olardı. Heç bir niyyət itirilmir, çünki heç bir
-- niyyət heç vaxt ekrana çıxmamışdı.
-- ============================================================================

alter table public.restaurants
  add column if not exists theme_background_color text not null default '#FAFAF9';

alter table public.restaurants
  add column if not exists theme_surface_color text not null default '#FFFFFF';

comment on column public.restaurants.theme_background_color is
  'Müştəri menyusunun səhifə fonu. .kit-light-da --k-bg-ə çevrilir. Footer-ə TƏSİR ETMİR (o, app/globals.css-dəki .customer-footer ilə sabit krem fonda təcrid olunub).';

comment on column public.restaurants.theme_surface_color is
  'Müştəri menyusunda kart/panel fonu. --k-surface. Aralıq tonlar (--k-surface-2/3, --k-border) bundan color-mix() ilə törəyir.';

comment on column public.restaurants.theme_secondary_color is
  'Müştəri menyusunun MƏTN rəngi (--k-text). 0043-ə qədər bu sütun yazılırdı, amma heç yerdə oxunmurdu — ona görə yeni sütun açmaq əvəzinə yenidən təyinatlandırılıb.';

-- Köhnə, heç vaxt görünməmiş dəyərləri defolta qaytar (yuxarıdakı izaha bax).
--
-- Dəyər #18181B-dir, sütunun 0006-dakı öz defoltu (#14151A) DEYİL: .kit-light
-- bu miqrasiyaya qədər mətn rəngini #18181B kimi sabit kodlamışdı. İki rəqəm
-- heç vaxt uyğun gəlmirdi, çünki sütun heç vaxt render olunmurdu. İndi o,
-- ekrandakı mətnin rəngidir — ona görə temaya heç toxunmamış bir restoranın
-- menyusu bu miqrasiyadan sonra da PİKSEL-PİKSEL əvvəlki kimi qalsın deyə
-- sütunun defoltu da kit-in köhnə sabitinə bərabərləşdirilir.
alter table public.restaurants alter column theme_secondary_color set default '#18181B';
update public.restaurants set theme_secondary_color = '#18181B';

-- ----------------------------------------------------------------------------
-- get_public_restaurant() — açıq sütun siyahısı genişlənir.
--
-- BU ADDIM MƏCBURİDİR: müştəri menyusu autentifikasiyasızdır və `restaurants`
-- cədvəlini birbaşa oxumur (o cədvəldə billing/PII sütunları var), yalnız bu
-- SECURITY DEFINER funksiyanın qaytardığı dar siyahını görür. Yeni sütunlar
-- buraya əlavə edilməsə, admin panelindəki bütün rəng seçiciləri işləyəcək,
-- dəyərlər bazaya yazılacaq, amma müştəri tərəfinə HEÇ VAXT çatmayacaq.
-- 0038_public_restaurant_feature_flags.sql eyni səbəbdən feature_flags-i
-- əlavə etmişdi — eyni nümunə.
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
    r.feature_flags, r.is_active, r.created_at
  from public.restaurants r
  where r.slug = p_slug and r.is_active = true;
$$;

grant execute on function public.get_public_restaurant(text) to anon, authenticated;
