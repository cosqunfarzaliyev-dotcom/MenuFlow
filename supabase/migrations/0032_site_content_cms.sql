-- ============================================================================
-- MenuFlow — açıq marketinq saytı üçün minimal CMS (səhifə mətnləri/əlaqə/FAQ)
-- ============================================================================
-- Marketinq saytının demək olar hamısı bu günə qədər JSX massivlərində və
-- lib/i18n/dictionaries/marketing.js-də hardcode edilib (yalnız /pricing
-- planService.js vasitəsilə bazadan oxuyur). SuperAdmin-in yeni "Veb sayt"
-- moduna bu üç şeyi redaktə etmək imkanı verilir: (a) səhifə mətnləri
-- (hero başlıqları/altyazılar/CTA etiketləri), (b) əlaqə məlumatları,
-- (c) FAQ sual-cavabları (əlavə/redaktə/sil/sırala). Bundan artıq heç nə —
-- xüsusiyyət kartları, rəylər, SEO sahələri və şəkil yükləmə qəsdən əhatədən
-- kənardır (repo-da Supabase Storage heç yerdə istifadə olunmur).
--
-- SXEM QƏRARI: bir jsonb "blob" singleton YOX, iki məqsədli cədvəl.
--   - FAQ əlavə/sil/sırala tələb edir — bu, sətirləri məcbur edir; jsonb
--     blob-da sıralama/sətir-səviyyəli updated_at/RLS mümkün deyil.
--   - Səhifə mətnləri + əlaqə cəmi ~35 düz üçdilli sətirdir — açar/dəyər
--     cədvəli buna uyğun gəlir və yeni başlıq üçün sxem dəyişikliyi tələb
--     etmir.
--
-- Üçdilli kodlaşdırma 0029-un (product_category_translations) formasının
-- EYNİSİDİR: AZ real sütunda (mənbə), yalnız EN/RU jsonb-də, adlı `_shape`
-- CHECK ilə (subquery CHECK-də Postgres 0A000 xətasıdır, ona görə
-- `(translations - 'en' - 'ru') = '{}'::jsonb` fəndi işlədilir).
--
-- AUDIT ƏVƏZİNƏ PROVENANCE: audit_logs.restaurant_id NOT NULL-dur
-- (0006_admin_feature_pack.sql) — platforma səviyyəli (restoransız) sətir
-- struktur olaraq mümkün deyil. Cədvəli nullable etmək AuditLogTab-ın/
-- fetchAuditLogs(restaurantId)-in tenant fərziyyəsini səssizcə pozardı.
-- Bunun əvəzinə hər iki cədvəldə updated_at/updated_by + trigger — "bu
-- başlığı sonuncu kim, nə vaxt dəyişdi" sualını cavablandırır ki, real
-- soruşulacaq sual da elə budur.
--
-- PUBLIC-READ: hər iki cədvəl açıq marketinq mətnidir — həssas sütun yoxdur,
-- ona görə get_public_restaurant() tipli SECURITY DEFINER RPC lazım deyil;
-- sadə `for select using (true)` kifayətdir (bax: products_public_read,
-- 0001_multi_tenant_saas.sql).
--
-- SUPER-ADMIN-WRITE: `plans`/`plan_features`-in eynisi (bax:
-- 0021_plan_subscription_system.sql, plans_super_admin_write).
--
-- 0031_product_nutrition.sql-dən sonra icra olunur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. site_content — açar/dəyər səhifə mətnləri + əlaqə məlumatları
-- ----------------------------------------------------------------------------
create table if not exists public.site_content (
  key           text primary key,
  value_az      text not null,
  translations  jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null
);

comment on table public.site_content is
  'Açıq marketinq saytının açar/dəyər mətnləri (hero başlıqları, CTA etiketləri, əlaqə məlumatları). SuperAdmin "Veb sayt" modundan redaktə olunur. Naming: <səhifə>.<bölmə>.<slot>, məs. home.hero.title.';

comment on column public.site_content.translations is
  'İstəyə bağlı EN/RU override: {"en":"...","ru":"..."} — dəyərlər DÜZ mətndir, obyekt deyil (products.translations-dan fərqli olaraq, çünki burada name/description cütü yoxdur, tək sətirdir). AZ mənbəyi həmişə value_az-dır.';

-- Səhv yazılmış locale açarının (məs. "eng") səssizcə heç vaxt render
-- olunmamasının qarşısını alır. Həm açar dəstini (yalnız en/ru), həm hər bir
-- dəyərin DÜZ mətn (obyekt deyil) olduğunu yoxlayır.
alter table public.site_content add constraint site_content_translations_shape
  check (
    jsonb_typeof(translations) = 'object'
    and (translations - 'en' - 'ru') = '{}'::jsonb
    and (translations -> 'en' is null or jsonb_typeof(translations -> 'en') = 'string')
    and (translations -> 'ru' is null or jsonb_typeof(translations -> 'ru') = 'string')
  );

-- ----------------------------------------------------------------------------
-- 2. site_faq_items — sıralana bilən FAQ sual/cavab sətirləri
-- ----------------------------------------------------------------------------
create table if not exists public.site_faq_items (
  id            uuid primary key default gen_random_uuid(),
  sort_order    int not null,
  is_published  boolean not null default true,
  question_az   text not null,
  answer_az     text not null,
  translations  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null
);

comment on table public.site_faq_items is
  '/faq səhifəsinin sual-cavab sətirləri, sort_order-a görə göstərilir. is_published=false sətir bazada qalır amma saytda görünmür (sil əvəzinə gizlətmə seçimi).';

comment on column public.site_faq_items.translations is
  'İstəyə bağlı EN/RU override: {"en":{"question":"...","answer":"..."},"ru":{...}}. AZ mənbəyi question_az/answer_az-dır. products.translations (0029) ilə eyni forma.';

-- sort_order-da unique: seed-in "on conflict (sort_order) do nothing" ilə
-- idempotent təkrar-icrasını mümkün edir (id hər dəfə gen_random_uuid() ilə
-- təzədir, ona görə id-yə görə konflikt hədəfi ola bilməz).
alter table public.site_faq_items add constraint site_faq_items_sort_order_key unique (sort_order);

alter table public.site_faq_items add constraint site_faq_items_translations_shape
  check (
    jsonb_typeof(translations) = 'object'
    and (translations - 'en' - 'ru') = '{}'::jsonb
  );

create index if not exists site_faq_items_published_sort_idx
  on public.site_faq_items (is_published, sort_order);
create index if not exists site_content_updated_by_idx on public.site_content (updated_by);
create index if not exists site_faq_items_updated_by_idx on public.site_faq_items (updated_by);

-- ----------------------------------------------------------------------------
-- 3. Provenance trigger — updated_at/updated_by, 0022-nin dərsi ilə
-- ----------------------------------------------------------------------------
-- `set search_path = public` MƏCBURİDİR: 0022_fix_touch_updated_at_search_path.sql
-- məhz bunun unudulması üzündən yaranıb və get_advisors-un
-- function_search_path_mutable tapıntısını doğurur.
create or replace function public.touch_site_content()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$fn$;

drop trigger if exists site_content_touch on public.site_content;
create trigger site_content_touch
  before update on public.site_content
  for each row execute procedure public.touch_site_content();

drop trigger if exists site_faq_items_touch on public.site_faq_items;
create trigger site_faq_items_touch
  before update on public.site_faq_items
  for each row execute procedure public.touch_site_content();

-- ----------------------------------------------------------------------------
-- 4. RLS — plans_public_read / plans_super_admin_write şablonunun eynisi
-- ----------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.site_faq_items enable row level security;

drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read" on public.site_content for select using (true);
drop policy if exists "site_content_super_admin_write" on public.site_content;
create policy "site_content_super_admin_write" on public.site_content
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "site_faq_items_public_read" on public.site_faq_items;
create policy "site_faq_items_public_read" on public.site_faq_items for select using (true);
drop policy if exists "site_faq_items_super_admin_write" on public.site_faq_items;
create policy "site_faq_items_super_admin_write" on public.site_faq_items
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. Seed — lib/i18n/dictionaries/marketing.js və pricing.js-dəki HAZIRKI
--    hardcode dəyərlərin eynilə köçürülməsi ki, sayt boş qalmasın.
--    scratchpad/gen-seed.mjs skripti ilə mexaniki çıxarılıb (əl ilə deyil) —
--    yazı səhvi riski sıfıra endirilib.
-- ----------------------------------------------------------------------------
insert into public.site_content (key, value_az, translations) values
  ('home.hero.eyebrow', 'QR Menyu & Restoran İdarəetmə Platforması', '{"en":"QR Menu & Restaurant Management Platform","ru":"Платформа QR-меню и управления рестораном"}'::jsonb),
  ('home.hero.title', 'Restoranınızı Rəqəmsal Dünyaya Daşıyın', '{"en":"Bring Your Restaurant Into the Digital Age","ru":"Переведите свой ресторан в цифровую эпоху"}'::jsonb),
  ('home.hero.subtitle', 'MenuFlow ilə QR menyu, canlı sifariş idarəetməsi, mətbəx bildirişləri, kampaniyalar və analitika — hamısı bir platformada.', '{"en":"QR menus, live order management, kitchen notifications, campaigns, and analytics — all in one platform with MenuFlow.","ru":"QR-меню, управление заказами в реальном времени, уведомления кухни, акции и аналитика — всё в одной платформе с MenuFlow."}'::jsonb),
  ('home.hero.cta_primary', 'Başlayın', '{"en":"Get Started","ru":"Начать"}'::jsonb),
  ('home.hero.cta_secondary', 'Demo-ya baxın', '{"en":"See the demo","ru":"Смотреть демо"}'::jsonb),
  ('home.hero.note', 'Qeydiyyat hesab yaradır — restoranınız platforma administratoru tərəfindən aktivləşdiriləcək.', '{"en":"Signing up creates a login — your restaurant will be activated by the platform administrator.","ru":"Регистрация создаёт учётную запись — ваш ресторан будет активирован администратором платформы."}'::jsonb),
  ('home.qr.eyebrow', 'Müştəri Təcrübəsi', '{"en":"Customer Experience","ru":"Опыт клиента"}'::jsonb),
  ('home.qr.title', 'Müştəriləriniz Saniyələr İçində Sifariş Versin', '{"en":"Let Your Customers Order in Seconds","ru":"Пусть ваши клиенты заказывают за секунды"}'::jsonb),
  ('home.qr.subtitle', 'Masadakı QR kodu skan edən müştəri dərhal rəqəmsal menyunuzu görür, sifariş verir və ofisiantı çağıra bilir — heç bir tətbiq yükləmədən.', '{"en":"A customer scanning the QR code at their table instantly sees your digital menu, places an order, and can call a waiter — no app download required.","ru":"Клиент, отсканировавший QR-код за столом, мгновенно видит ваше цифровое меню, оформляет заказ и может вызвать официанта — без скачивания приложения."}'::jsonb),
  ('home.features.eyebrow', 'Xüsusiyyətlər', '{"en":"Features","ru":"Возможности"}'::jsonb),
  ('home.features.title', 'Bir Platforma, Bütün Ehtiyaclar', '{"en":"One Platform, Every Need","ru":"Одна платформа для всех задач"}'::jsonb),
  ('home.features.subtitle', 'Menyunuzdan tutmuş ödənişlərə qədər restoranınızın rəqəmsal idarəetməsi üçün lazım olan hər şey.', '{"en":"Everything you need to digitally manage your restaurant, from the menu to payments.","ru":"Всё необходимое для цифрового управления рестораном — от меню до платежей."}'::jsonb),
  ('home.ecosystem.eyebrow', 'Ekosistem', '{"en":"Ecosystem","ru":"Экосистема"}'::jsonb),
  ('home.ecosystem.title', 'Hər Rol Üçün Öz Paneli', '{"en":"A Panel Built for Every Role","ru":"Своя панель для каждой роли"}'::jsonb),
  ('home.ecosystem.subtitle', 'Müştəridən platforma administratoruna qədər hər kəsin öz ehtiyacına uyğun bir görünüşü var.', '{"en":"From the customer to the platform administrator, everyone gets a view built for their needs.","ru":"От клиента до администратора платформы — у каждого своё представление, созданное под его задачи."}'::jsonb),
  ('home.pricing_cta.eyebrow', 'Qiymətlər', '{"en":"Pricing","ru":"Тарифы"}'::jsonb),
  ('home.pricing_cta.title', 'Sadə, Şəffaf Qiymətləndirmə', '{"en":"Simple, Transparent Pricing","ru":"Простые, прозрачные тарифы"}'::jsonb),
  ('home.pricing_cta.subtitle', 'Restoranınızın ölçüsünə uyğun planı seçin. Gizli ödəniş yoxdur.', '{"en":"Choose the plan that fits your restaurant''s size. No hidden fees.","ru":"Выберите тариф, подходящий размеру вашего ресторана. Никаких скрытых платежей."}'::jsonb),
  ('home.pricing_cta.button', 'Qiymətlərə baxın', '{"en":"View pricing","ru":"Смотреть тарифы"}'::jsonb),
  ('home.faq_cta.eyebrow', 'Suallar', '{"en":"FAQ","ru":"Вопросы"}'::jsonb),
  ('home.faq_cta.title', 'Tez-tez Verilən Suallar', '{"en":"Frequently Asked Questions","ru":"Часто задаваемые вопросы"}'::jsonb),
  ('home.contact_cta.eyebrow', 'Əlaqə', '{"en":"Contact","ru":"Контакты"}'::jsonb),
  ('home.contact_cta.title', 'Suallarınız var?', '{"en":"Have Questions?","ru":"Остались вопросы?"}'::jsonb),
  ('home.contact_cta.subtitle', 'Komandamız MenuFlow-un restoranınıza necə uyğunlaşacağını izah etməkdən məmnun olar.', '{"en":"Our team would be happy to walk you through how MenuFlow fits your restaurant.","ru":"Наша команда с радостью расскажет, как MenuFlow подойдёт вашему ресторану."}'::jsonb),
  ('home.contact_cta.button', 'Bizimlə əlaqə saxlayın', '{"en":"Get in touch","ru":"Связаться с нами"}'::jsonb),
  ('features.hero.eyebrow', 'Xüsusiyyətlər', '{"en":"Features","ru":"Возможности"}'::jsonb),
  ('features.hero.title', 'Restoranınız üçün lazım olan hər şey', '{"en":"Everything your restaurant needs","ru":"Всё, что нужно вашему ресторану"}'::jsonb),
  ('features.hero.subtitle', 'QR menyudan çoxrestoranlı idarəetməyə qədər MenuFlow-un təqdim etdiyi bütün xüsusiyyətlər.', '{"en":"From the QR menu to multi-restaurant management, every feature MenuFlow offers.","ru":"От QR-меню до управления несколькими ресторанами — все возможности MenuFlow."}'::jsonb),
  ('features.cta.title', 'Başlamağa hazırsınız?', '{"en":"Ready to get started?","ru":"Готовы начать?"}'::jsonb),
  ('features.cta.subtitle', 'Qeydiyyatdan keçin, platforma administratoru restoranınızı aktivləşdirsin.', '{"en":"Sign up, and the platform administrator will activate your restaurant.","ru":"Зарегистрируйтесь, и администратор платформы активирует ваш ресторан."}'::jsonb),
  ('features.cta.button', 'Bizimlə əlaqə saxlayın', '{"en":"Get in touch","ru":"Связаться с нами"}'::jsonb),
  ('faq.hero.eyebrow', 'Suallar', '{"en":"FAQ","ru":"Вопросы"}'::jsonb),
  ('faq.hero.title', 'Tez-tez Verilən Suallar', '{"en":"Frequently Asked Questions","ru":"Часто задаваемые вопросы"}'::jsonb),
  ('faq.hero.subtitle', 'Sualınızın cavabını tapa bilmədinizmi?', '{"en":"Can''t find the answer you''re looking for?","ru":"Не нашли ответ на свой вопрос?"}'::jsonb),
  ('demo.hero.eyebrow', 'Demo', '{"en":"Demo","ru":"Демо"}'::jsonb),
  ('demo.hero.title', 'MenuFlow-u Əməldə Görün', '{"en":"See MenuFlow in Action","ru":"Посмотрите MenuFlow в действии"}'::jsonb),
  ('demo.hero.subtitle', 'Müştərilərinizin göreceği rəqəmsal menyunun nümunə önizləməsi — real komponentlərlə hazırlanıb.', '{"en":"A sample preview of the digital menu your customers will see — built with the real components.","ru":"Пример предпросмотра цифрового меню, которое увидят ваши клиенты — построен на реальных компонентах."}'::jsonb),
  ('demo.cta.title', 'Canlı Nümayiş İstəyirsiniz?', '{"en":"Want a Live Walkthrough?","ru":"Хотите живую демонстрацию?"}'::jsonb),
  ('demo.cta.subtitle', 'Komandamızla əlaqə saxlayın, restoranınıza xüsusi canlı nümayiş təşkil edək.', '{"en":"Get in touch with our team and we''ll set up a live demo tailored to your restaurant.","ru":"Свяжитесь с нашей командой, и мы организуем живую демонстрацию специально для вашего ресторана."}'::jsonb),
  ('demo.cta.button', 'Bizimlə əlaqə saxlayın', '{"en":"Get in touch","ru":"Связаться с нами"}'::jsonb),
  ('contact.hero.eyebrow', 'Əlaqə', '{"en":"Contact","ru":"Контакты"}'::jsonb),
  ('contact.hero.title', 'Bizimlə Əlaqə Saxlayın', '{"en":"Get in Touch","ru":"Свяжитесь с нами"}'::jsonb),
  ('contact.hero.subtitle', 'Sualınız var, demo istəyirsiniz və ya restoranınızı MenuFlow-a keçirmək istəyirsiniz? Aşağıdakı kanallardan bizə yazın.', '{"en":"Have a question, want a demo, or ready to bring your restaurant onto MenuFlow? Reach us through the channels below.","ru":"Есть вопрос, хотите демо или готовы перевести свой ресторан на MenuFlow? Напишите нам через каналы ниже."}'::jsonb),
  ('pricing.hero.title', 'Qiymətləndirmə', '{"en":"Pricing","ru":"Тарифы"}'::jsonb),
  ('pricing.hero.subtitle', 'Restoranınızın ölçüsünə uyğun planı seçin. Bütün planlar QR menyu, sifariş idarəetməsi və canlı bildirişləri əhatə edir.', '{"en":"Choose the plan that fits your restaurant. Every plan includes a QR menu, order management, and live notifications.","ru":"Выберите тариф, подходящий для вашего ресторана. Каждый тариф включает QR-меню, управление заказами и живые уведомления."}'::jsonb),
  ('contact.whatsapp_url', 'https://wa.me/994000000000', '{}'::jsonb),
  ('contact.email', 'hello@menuflow.app', '{}'::jsonb),
  ('contact.address', '', '{}'::jsonb)
on conflict (key) do nothing;

insert into public.site_faq_items (sort_order, question_az, answer_az, translations) values
  (10, 'MenuFlow necə işləyir?', 'Hər masaya unikal, imzalı QR kod verilir. Müştəri onu skan edir, rəqəmsal menyunuza baxır və sifarişi birbaşa ofisiant və mətbəx panelinə göndərir.', '{"en":{"question":"How does MenuFlow work?","answer":"Every table gets a unique, signed QR code. A customer scans it, browses your digital menu, and their order goes straight to the waiter and kitchen panel."},"ru":{"question":"Как работает MenuFlow?","answer":"Каждому столу присваивается уникальный подписанный QR-код. Клиент сканирует его, просматривает ваше цифровое меню, и заказ сразу отправляется в панель официанта и кухни."}}'::jsonb),
  (20, 'Hesab necə yaradıram?', 'Qeydiyyatdan keçərək bir login (e-poçt + şifrə) yaradırsınız. Bu, avtomatik olaraq restoran yaratmır — platforma administratoru restoranı yaradıb bu hesabı ona admin kimi təyin edir.', '{"en":{"question":"How do I create an account?","answer":"Signing up creates a login (email + password). This doesn''t automatically create a restaurant — the platform administrator creates the restaurant and assigns this account as its admin."},"ru":{"question":"Как создать аккаунт?","answer":"Регистрация создаёт учётную запись (email + пароль). Это не создаёт ресторан автоматически — администратор платформы создаёт ресторан и назначает эту учётную запись его администратором."}}'::jsonb),
  (30, 'Pulsuz sınaq varmı?', 'Bəli. Restoranınız yaradılıb aktivləşdiriləndə platforma administratoru sınaq müddəti təyin edə bilər. Sınaq avtomatik başlamır — bu, qeydiyyatdan sonrakı aktivləşdirmə addımının bir hissəsidir.', '{"en":{"question":"Is there a free trial?","answer":"Yes. When your restaurant is created and activated, the platform administrator can set a trial period. The trial doesn''t start automatically — it''s part of that activation step."},"ru":{"question":"Есть ли бесплатный пробный период?","answer":"Да. Когда ваш ресторан создан и активирован, администратор платформы может установить пробный период. Он не начинается автоматически — это часть шага активации."}}'::jsonb),
  (40, 'Hansı dillər dəstəklənir?', 'Azərbaycan, İngilis və Rus dilləri. Müştəri menyusu daxil olmaqla bütün panellərdə dil seçimi mövcuddur və seçiminiz yadda saxlanılır.', '{"en":{"question":"What languages are supported?","answer":"Azerbaijani, English, and Russian. Language selection is available across every panel including the customer menu, and your choice is remembered."},"ru":{"question":"Какие языки поддерживаются?","answer":"Азербайджанский, английский и русский. Выбор языка доступен во всех панелях, включая меню клиента, и сохраняется автоматически."}}'::jsonb),
  (50, 'Hansı ödəniş üsulları dəstəklənir?', 'Nəğd, kart (post-terminal), Apple Pay və Google Pay. Ödəniş heç vaxt tətbiq daxilində aparılmır — müştəri masada ofisiantla hesablaşır, tətbiq yalnız seçilmiş üsulu qeyd edir.', '{"en":{"question":"What payment methods are supported?","answer":"Cash, card (POS terminal), Apple Pay, and Google Pay. Payment never happens inside the app — the customer settles up with the waiter at the table; the app only records the chosen method."},"ru":{"question":"Какие способы оплаты поддерживаются?","answer":"Наличные, карта (POS-терминал), Apple Pay и Google Pay. Оплата никогда не происходит внутри приложения — клиент рассчитывается с официантом за столом, приложение лишь фиксирует выбранный способ."}}'::jsonb),
  (60, 'Fakturalaşdırma necə işləyir?', 'Fakturalaşdırma tam əl ilə aparılır — avtomatik gündəlik ödəniş sistemi yoxdur. Plan və abunəlik statusu platforma administratoru tərəfindən idarə olunur.', '{"en":{"question":"How does billing work?","answer":"Billing is fully manual — there''s no automatic recurring charge system. Plan and subscription status are managed by the platform administrator."},"ru":{"question":"Как работает выставление счетов?","answer":"Выставление счетов полностью ручное — автоматической системы регулярных списаний нет. Тариф и статус подписки управляются администратором платформы."}}'::jsonb),
  (70, 'Məlumatlarım təhlükəsizdirmi?', 'Bəli. Hər restoranın məlumatları verilənlər bazası səviyyəsində (Row Level Security) digər restoranlardan tam təcrid olunub — bir restoranın işçisi başqa restoranın məlumatlarını heç vaxt görə bilməz.', '{"en":{"question":"Is my data secure?","answer":"Yes. Every restaurant''s data is fully isolated from every other at the database level (Row Level Security) — staff at one restaurant can never see another restaurant''s data."},"ru":{"question":"Безопасны ли мои данные?","answer":"Да. Данные каждого ресторана полностью изолированы от других на уровне базы данных (Row Level Security) — сотрудники одного ресторана никогда не видят данные другого."}}'::jsonb),
  (80, 'Neçə masa və məhsul əlavə edə bilərəm?', 'Masa sayını Parametrlər bölməsindən istədiyiniz zaman dəyişə bilərsiniz — QR kodlar avtomatik yenilənir. Məhsul və kateqoriya sayında süni məhdudiyyət yoxdur.', '{"en":{"question":"How many tables and products can I add?","answer":"You can change your table count from Settings at any time — QR codes update automatically. There is no artificial limit on products or categories."},"ru":{"question":"Сколько столов и товаров можно добавить?","answer":"Вы можете изменить количество столов в настройках в любое время — QR-коды обновляются автоматически. Искусственного ограничения на количество товаров или категорий нет."}}'::jsonb),
  (90, 'Ofisiant panelini necə istifadə edirəm?', 'Eyni email və şifrə ilə həm Admin panelinə (/admin), həm də Ofisiant/Mətbəx panelinə (/staff) daxil ola bilərsiniz — ayrıca ofisiant qeydiyyatı tələb olunmur.', '{"en":{"question":"How do I use the staff panel?","answer":"You can sign in to both the Admin panel (/admin) and the Staff / Kitchen panel (/staff) with the same email and password — no separate staff registration is required."},"ru":{"question":"Как пользоваться панелью официанта?","answer":"Вы можете входить как в панель администратора (/admin), так и в панель официанта/кухни (/staff) с тем же email и паролем — отдельная регистрация официанта не требуется."}}'::jsonb),
  (100, 'Dəstək üçün necə əlaqə saxlaya bilərəm?', 'Əlaqə səhifəmizdən WhatsApp və ya e-poçt vasitəsilə bizə yaza bilərsiniz.', '{"en":{"question":"How can I get support?","answer":"You can reach us via WhatsApp or email from our Contact page."},"ru":{"question":"Как связаться со службой поддержки?","answer":"Вы можете написать нам через WhatsApp или email на странице контактов."}}'::jsonb)
on conflict (sort_order) do nothing;
