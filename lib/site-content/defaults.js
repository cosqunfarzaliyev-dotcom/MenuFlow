// ============================================================================
// MenuFlow — offline defaults for site_content / site_faq_items
// ============================================================================
// Mechanically generated (scratchpad/gen-defaults.mjs) from the same source
// dictionaries as supabase/migrations/0032_site_content_cms.sql's seed section
// — DO NOT hand-edit the values here without also updating that migration's
// seed, or the two will silently diverge.
//
// Consumed when supabaseServerReady is false (lib/supabase-server.js) — same
// "app still renders without .env.local" guarantee CLAUDE.md documents for
// data/menu.json, extended to the marketing CMS content.
// ============================================================================

export const SITE_CONTENT_DEFAULTS = {
  "home.hero.eyebrow": { az: "QR Menyu & Restoran İdarəetmə Platforması", en: "QR Menu & Restaurant Management Platform", ru: "Платформа QR-меню и управления рестораном" },
  "home.hero.title": { az: "Restoranınızı Rəqəmsal Dünyaya Daşıyın", en: "Bring Your Restaurant Into the Digital Age", ru: "Переведите свой ресторан в цифровую эпоху" },
  "home.hero.subtitle": { az: "MenuFlow ilə QR menyu, canlı sifariş idarəetməsi, mətbəx bildirişləri, kampaniyalar və analitika — hamısı bir platformada.", en: "QR menus, live order management, kitchen notifications, campaigns, and analytics — all in one platform with MenuFlow.", ru: "QR-меню, управление заказами в реальном времени, уведомления кухни, акции и аналитика — всё в одной платформе с MenuFlow." },
  "home.hero.cta_primary": { az: "Başlayın", en: "Get Started", ru: "Начать" },
  "home.hero.cta_secondary": { az: "Demo-ya baxın", en: "See the demo", ru: "Смотреть демо" },
  "home.hero.note": { az: "Qeydiyyat hesab yaradır — restoranınız platforma administratoru tərəfindən aktivləşdiriləcək.", en: "Signing up creates a login — your restaurant will be activated by the platform administrator.", ru: "Регистрация создаёт учётную запись — ваш ресторан будет активирован администратором платформы." },
  "home.qr.eyebrow": { az: "Müştəri Təcrübəsi", en: "Customer Experience", ru: "Опыт клиента" },
  "home.qr.title": { az: "Müştəriləriniz Saniyələr İçində Sifariş Versin", en: "Let Your Customers Order in Seconds", ru: "Пусть ваши клиенты заказывают за секунды" },
  "home.qr.subtitle": { az: "Masadakı QR kodu skan edən müştəri dərhal rəqəmsal menyunuzu görür, sifariş verir və ofisiantı çağıra bilir — heç bir tətbiq yükləmədən.", en: "A customer scanning the QR code at their table instantly sees your digital menu, places an order, and can call a waiter — no app download required.", ru: "Клиент, отсканировавший QR-код за столом, мгновенно видит ваше цифровое меню, оформляет заказ и может вызвать официанта — без скачивания приложения." },
  "home.features.eyebrow": { az: "Xüsusiyyətlər", en: "Features", ru: "Возможности" },
  "home.features.title": { az: "Bir Platforma, Bütün Ehtiyaclar", en: "One Platform, Every Need", ru: "Одна платформа для всех задач" },
  "home.features.subtitle": { az: "Menyunuzdan tutmuş ödənişlərə qədər restoranınızın rəqəmsal idarəetməsi üçün lazım olan hər şey.", en: "Everything you need to digitally manage your restaurant, from the menu to payments.", ru: "Всё необходимое для цифрового управления рестораном — от меню до платежей." },
  "home.ecosystem.eyebrow": { az: "Ekosistem", en: "Ecosystem", ru: "Экосистема" },
  "home.ecosystem.title": { az: "Hər Rol Üçün Öz Paneli", en: "A Panel Built for Every Role", ru: "Своя панель для каждой роли" },
  "home.ecosystem.subtitle": { az: "Müştəridən platforma administratoruna qədər hər kəsin öz ehtiyacına uyğun bir görünüşü var.", en: "From the customer to the platform administrator, everyone gets a view built for their needs.", ru: "От клиента до администратора платформы — у каждого своё представление, созданное под его задачи." },
  "home.pricing_cta.eyebrow": { az: "Qiymətlər", en: "Pricing", ru: "Тарифы" },
  "home.pricing_cta.title": { az: "Sadə, Şəffaf Qiymətləndirmə", en: "Simple, Transparent Pricing", ru: "Простые, прозрачные тарифы" },
  "home.pricing_cta.subtitle": { az: "Restoranınızın ölçüsünə uyğun planı seçin. Gizli ödəniş yoxdur.", en: "Choose the plan that fits your restaurant's size. No hidden fees.", ru: "Выберите тариф, подходящий размеру вашего ресторана. Никаких скрытых платежей." },
  "home.pricing_cta.button": { az: "Qiymətlərə baxın", en: "View pricing", ru: "Смотреть тарифы" },
  "home.faq_cta.eyebrow": { az: "Suallar", en: "FAQ", ru: "Вопросы" },
  "home.faq_cta.title": { az: "Tez-tez Verilən Suallar", en: "Frequently Asked Questions", ru: "Часто задаваемые вопросы" },
  "home.contact_cta.eyebrow": { az: "Əlaqə", en: "Contact", ru: "Контакты" },
  "home.contact_cta.title": { az: "Suallarınız var?", en: "Have Questions?", ru: "Остались вопросы?" },
  "home.contact_cta.subtitle": { az: "Komandamız MenuFlow-un restoranınıza necə uyğunlaşacağını izah etməkdən məmnun olar.", en: "Our team would be happy to walk you through how MenuFlow fits your restaurant.", ru: "Наша команда с радостью расскажет, как MenuFlow подойдёт вашему ресторану." },
  "home.contact_cta.button": { az: "Bizimlə əlaqə saxlayın", en: "Get in touch", ru: "Связаться с нами" },
  "features.hero.eyebrow": { az: "Xüsusiyyətlər", en: "Features", ru: "Возможности" },
  "features.hero.title": { az: "Restoranınız üçün lazım olan hər şey", en: "Everything your restaurant needs", ru: "Всё, что нужно вашему ресторану" },
  "features.hero.subtitle": { az: "QR menyudan çoxrestoranlı idarəetməyə qədər MenuFlow-un təqdim etdiyi bütün xüsusiyyətlər.", en: "From the QR menu to multi-restaurant management, every feature MenuFlow offers.", ru: "От QR-меню до управления несколькими ресторанами — все возможности MenuFlow." },
  "features.cta.title": { az: "Başlamağa hazırsınız?", en: "Ready to get started?", ru: "Готовы начать?" },
  "features.cta.subtitle": { az: "Qeydiyyatdan keçin, platforma administratoru restoranınızı aktivləşdirsin.", en: "Sign up, and the platform administrator will activate your restaurant.", ru: "Зарегистрируйтесь, и администратор платформы активирует ваш ресторан." },
  "features.cta.button": { az: "Bizimlə əlaqə saxlayın", en: "Get in touch", ru: "Связаться с нами" },
  "faq.hero.eyebrow": { az: "Suallar", en: "FAQ", ru: "Вопросы" },
  "faq.hero.title": { az: "Tez-tez Verilən Suallar", en: "Frequently Asked Questions", ru: "Часто задаваемые вопросы" },
  "faq.hero.subtitle": { az: "Sualınızın cavabını tapa bilmədinizmi?", en: "Can't find the answer you're looking for?", ru: "Не нашли ответ на свой вопрос?" },
  "demo.hero.eyebrow": { az: "Demo", en: "Demo", ru: "Демо" },
  "demo.hero.title": { az: "MenuFlow-u Əməldə Görün", en: "See MenuFlow in Action", ru: "Посмотрите MenuFlow в действии" },
  "demo.hero.subtitle": { az: "Müştərilərinizin göreceği rəqəmsal menyunun nümunə önizləməsi — real komponentlərlə hazırlanıb.", en: "A sample preview of the digital menu your customers will see — built with the real components.", ru: "Пример предпросмотра цифрового меню, которое увидят ваши клиенты — построен на реальных компонентах." },
  "demo.cta.title": { az: "Canlı Nümayiş İstəyirsiniz?", en: "Want a Live Walkthrough?", ru: "Хотите живую демонстрацию?" },
  "demo.cta.subtitle": { az: "Komandamızla əlaqə saxlayın, restoranınıza xüsusi canlı nümayiş təşkil edək.", en: "Get in touch with our team and we'll set up a live demo tailored to your restaurant.", ru: "Свяжитесь с нашей командой, и мы организуем живую демонстрацию специально для вашего ресторана." },
  "demo.cta.button": { az: "Bizimlə əlaqə saxlayın", en: "Get in touch", ru: "Связаться с нами" },
  "contact.hero.eyebrow": { az: "Əlaqə", en: "Contact", ru: "Контакты" },
  "contact.hero.title": { az: "Bizimlə Əlaqə Saxlayın", en: "Get in Touch", ru: "Свяжитесь с нами" },
  "contact.hero.subtitle": { az: "Sualınız var, demo istəyirsiniz və ya restoranınızı MenuFlow-a keçirmək istəyirsiniz? Aşağıdakı kanallardan bizə yazın.", en: "Have a question, want a demo, or ready to bring your restaurant onto MenuFlow? Reach us through the channels below.", ru: "Есть вопрос, хотите демо или готовы перевести свой ресторан на MenuFlow? Напишите нам через каналы ниже." },
  "pricing.hero.title": { az: "Qiymətləndirmə", en: "Pricing", ru: "Тарифы" },
  "pricing.hero.subtitle": { az: "Restoranınızın ölçüsünə uyğun planı seçin. Bütün planlar QR menyu, sifariş idarəetməsi və canlı bildirişləri əhatə edir.", en: "Choose the plan that fits your restaurant. Every plan includes a QR menu, order management, and live notifications.", ru: "Выберите тариф, подходящий для вашего ресторана. Каждый тариф включает QR-меню, управление заказами и живые уведомления." },
  'contact.whatsapp_url': { az: "https://wa.me/994000000000", en: "https://wa.me/994000000000", ru: "https://wa.me/994000000000" },
  'contact.email': { az: "hello@menuflow.app", en: "hello@menuflow.app", ru: "hello@menuflow.app" },
  'contact.address': { az: "", en: "", ru: "" },
};

export const SITE_FAQ_DEFAULTS = [
  {
    id: "default-1",
    sortOrder: 10,
    question: { az: "MenuFlow necə işləyir?", en: "How does MenuFlow work?", ru: "Как работает MenuFlow?" },
    answer: { az: "Hər masaya unikal, imzalı QR kod verilir. Müştəri onu skan edir, rəqəmsal menyunuza baxır və sifarişi birbaşa ofisiant və mətbəx panelinə göndərir.", en: "Every table gets a unique, signed QR code. A customer scans it, browses your digital menu, and their order goes straight to the waiter and kitchen panel.", ru: "Каждому столу присваивается уникальный подписанный QR-код. Клиент сканирует его, просматривает ваше цифровое меню, и заказ сразу отправляется в панель официанта и кухни." },
  },
  {
    id: "default-2",
    sortOrder: 20,
    question: { az: "Hesab necə yaradıram?", en: "How do I create an account?", ru: "Как создать аккаунт?" },
    answer: { az: "Qeydiyyatdan keçərək bir login (e-poçt + şifrə) yaradırsınız. Bu, avtomatik olaraq restoran yaratmır — platforma administratoru restoranı yaradıb bu hesabı ona admin kimi təyin edir.", en: "Signing up creates a login (email + password). This doesn't automatically create a restaurant — the platform administrator creates the restaurant and assigns this account as its admin.", ru: "Регистрация создаёт учётную запись (email + пароль). Это не создаёт ресторан автоматически — администратор платформы создаёт ресторан и назначает эту учётную запись его администратором." },
  },
  {
    id: "default-3",
    sortOrder: 30,
    question: { az: "Pulsuz sınaq varmı?", en: "Is there a free trial?", ru: "Есть ли бесплатный пробный период?" },
    answer: { az: "Bəli. Restoranınız yaradılıb aktivləşdiriləndə platforma administratoru sınaq müddəti təyin edə bilər. Sınaq avtomatik başlamır — bu, qeydiyyatdan sonrakı aktivləşdirmə addımının bir hissəsidir.", en: "Yes. When your restaurant is created and activated, the platform administrator can set a trial period. The trial doesn't start automatically — it's part of that activation step.", ru: "Да. Когда ваш ресторан создан и активирован, администратор платформы может установить пробный период. Он не начинается автоматически — это часть шага активации." },
  },
  {
    id: "default-4",
    sortOrder: 40,
    question: { az: "Hansı dillər dəstəklənir?", en: "What languages are supported?", ru: "Какие языки поддерживаются?" },
    answer: { az: "Azərbaycan, İngilis və Rus dilləri. Müştəri menyusu daxil olmaqla bütün panellərdə dil seçimi mövcuddur və seçiminiz yadda saxlanılır.", en: "Azerbaijani, English, and Russian. Language selection is available across every panel including the customer menu, and your choice is remembered.", ru: "Азербайджанский, английский и русский. Выбор языка доступен во всех панелях, включая меню клиента, и сохраняется автоматически." },
  },
  {
    id: "default-5",
    sortOrder: 50,
    question: { az: "Hansı ödəniş üsulları dəstəklənir?", en: "What payment methods are supported?", ru: "Какие способы оплаты поддерживаются?" },
    answer: { az: "Nəğd, kart (post-terminal), Apple Pay və Google Pay. Ödəniş heç vaxt tətbiq daxilində aparılmır — müştəri masada ofisiantla hesablaşır, tətbiq yalnız seçilmiş üsulu qeyd edir.", en: "Cash, card (POS terminal), Apple Pay, and Google Pay. Payment never happens inside the app — the customer settles up with the waiter at the table; the app only records the chosen method.", ru: "Наличные, карта (POS-терминал), Apple Pay и Google Pay. Оплата никогда не происходит внутри приложения — клиент рассчитывается с официантом за столом, приложение лишь фиксирует выбранный способ." },
  },
  {
    id: "default-6",
    sortOrder: 60,
    question: { az: "Fakturalaşdırma necə işləyir?", en: "How does billing work?", ru: "Как работает выставление счетов?" },
    answer: { az: "Fakturalaşdırma tam əl ilə aparılır — avtomatik gündəlik ödəniş sistemi yoxdur. Plan və abunəlik statusu platforma administratoru tərəfindən idarə olunur.", en: "Billing is fully manual — there's no automatic recurring charge system. Plan and subscription status are managed by the platform administrator.", ru: "Выставление счетов полностью ручное — автоматической системы регулярных списаний нет. Тариф и статус подписки управляются администратором платформы." },
  },
  {
    id: "default-7",
    sortOrder: 70,
    question: { az: "Məlumatlarım təhlükəsizdirmi?", en: "Is my data secure?", ru: "Безопасны ли мои данные?" },
    answer: { az: "Bəli. Hər restoranın məlumatları verilənlər bazası səviyyəsində (Row Level Security) digər restoranlardan tam təcrid olunub — bir restoranın işçisi başqa restoranın məlumatlarını heç vaxt görə bilməz.", en: "Yes. Every restaurant's data is fully isolated from every other at the database level (Row Level Security) — staff at one restaurant can never see another restaurant's data.", ru: "Да. Данные каждого ресторана полностью изолированы от других на уровне базы данных (Row Level Security) — сотрудники одного ресторана никогда не видят данные другого." },
  },
  {
    id: "default-8",
    sortOrder: 80,
    question: { az: "Neçə masa və məhsul əlavə edə bilərəm?", en: "How many tables and products can I add?", ru: "Сколько столов и товаров можно добавить?" },
    answer: { az: "Masa sayını Parametrlər bölməsindən istədiyiniz zaman dəyişə bilərsiniz — QR kodlar avtomatik yenilənir. Məhsul və kateqoriya sayında süni məhdudiyyət yoxdur.", en: "You can change your table count from Settings at any time — QR codes update automatically. There is no artificial limit on products or categories.", ru: "Вы можете изменить количество столов в настройках в любое время — QR-коды обновляются автоматически. Искусственного ограничения на количество товаров или категорий нет." },
  },
  {
    id: "default-9",
    sortOrder: 90,
    question: { az: "Ofisiant panelini necə istifadə edirəm?", en: "How do I use the staff panel?", ru: "Как пользоваться панелью официанта?" },
    answer: { az: "Eyni email və şifrə ilə həm Admin panelinə (/admin), həm də Ofisiant/Mətbəx panelinə (/staff) daxil ola bilərsiniz — ayrıca ofisiant qeydiyyatı tələb olunmur.", en: "You can sign in to both the Admin panel (/admin) and the Staff / Kitchen panel (/staff) with the same email and password — no separate staff registration is required.", ru: "Вы можете входить как в панель администратора (/admin), так и в панель официанта/кухни (/staff) с тем же email и паролем — отдельная регистрация официанта не требуется." },
  },
  {
    id: "default-10",
    sortOrder: 100,
    question: { az: "Dəstək üçün necə əlaqə saxlaya bilərəm?", en: "How can I get support?", ru: "Как связаться со службой поддержки?" },
    answer: { az: "Əlaqə səhifəmizdən WhatsApp və ya e-poçt vasitəsilə bizə yaza bilərsiniz.", en: "You can reach us via WhatsApp or email from our Contact page.", ru: "Вы можете написать нам через WhatsApp или email на странице контактов." },
  },
];

