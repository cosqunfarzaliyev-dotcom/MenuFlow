import { createTranslationHook } from '@/lib/i18n';

// Public marketing website: shared header/footer + `/` (home), `/features`,
// `/faq`, `/demo`, `/contact`. `/pricing` itself keeps using its own
// `lib/i18n/dictionaries/pricing.js` (unchanged) — this dictionary only
// supplies the shared MarketingHeader/Footer strings and the pricing *CTA
// teaser* on the homepage. Same {az,en,ru} + createTranslationHook pattern
// as every other dictionary. Unlike the localization sweep, there's no
// pre-existing AZ text to preserve here — every page is brand new, so AZ is
// authored fresh alongside EN/RU rather than being the "original" to match.
//
// Content is deliberately grounded in real product behavior — see
// CLAUDE.md's D1 decision (sign-up creates a login only, a super admin
// activates the restaurant) and "Billing is fully manual" — never implies
// instant self-service signup or automatic recurring billing.
export const marketing = {
  az: {
    // Shared header
    navFeatures: 'Xüsusiyyətlər',
    navPricing: 'Qiymətlər',
    navFaq: 'Suallar',
    navDemo: 'Demo',
    navContact: 'Əlaqə',
    getStartedButton: 'Müraciət et',
    openMenuAriaLabel: 'Menyunu aç',
    closeMenuAriaLabel: 'Menyunu bağla',

    // Shared footer
    footerTagline: 'Restoranınız üçün rəqəmsal QR menyu və idarəetmə platforması.',
    footerProductHeading: 'Məhsul',
    footerCompanyHeading: 'Şirkət',
    footerContactHeading: 'Əlaqə',
    footerWhatsappLabel: 'WhatsApp',
    footerEmailLabel: 'E-poçt',
    footerCopyright: (year) => `© ${year} MenuFlow. Bütün hüquqlar qorunur.`,
    footerLoginLink: 'Girişlər üçün',

    // Shared <meta> tags — app/[locale]/layout.jsx's generateMetadata() and
    // opengraph-image.jsx. (Every page-specific hero/CTA string that used to
    // sit in this file — heroTitle, qrShowcaseTitle, pricingCtaTitle, etc. —
    // moved to site_content in Phase 3; see
    // lib/services/siteContentService.js's SITE_CONTENT_GROUPS for the full
    // list and supabase/migrations/0032_site_content_cms.sql for the schema.
    // What's LEFT in this file below is chrome/nav/labels and small
    // structured lists — deliberately out of the minimal CMS's scope.)
    metaSiteName: 'MenuFlow',
    metaSiteTitle: 'MenuFlow — QR Menyu & Restoran İdarəetmə Platforması',
    metaSiteDescription: 'MenuFlow ilə QR menyu, canlı sifariş idarəetməsi, mətbəx bildirişləri, kampaniyalar və analitika — hamısı bir platformada.',

    // Home — QR showcase bullet list (the eyebrow/title/subtitle above this
    // list live in site_content as home.qr.*)
    heroTableLabel: 'Masa 4',
    heroTicketStatusLabel: 'Mətbəxə göndərildi',
    qrShowcasePoint1: 'Tətbiqsiz, ani sifariş',
    qrShowcasePoint2: 'Ofisiant və mətbəxə canlı bildiriş',
    qrShowcasePoint3: 'AZ / EN / RU dillərində menyu',

    // Home — Features teaser
    seeAllFeaturesLink: 'Bütün xüsusiyyətlərə baxın',

    // Feature cards (used on both / home teaser and /features full page)
    // /features page section headings — see that file's header for why
    // the split is 'Zalda'/'Mətbəxdə' (front-of-house/back-of-house), not
    // an arbitrary grouping
    featuresFrontOfHouseTitle: 'Zalda',
    featuresFrontOfHouseSubtitle: 'Müştərinin masada gördüyü hissə.',
    featuresBackOfHouseTitle: 'Mətbəxdə',
    featuresBackOfHouseSubtitle: 'Heyət və adminin arxa planda idarə etdiyi hissə.',

    featureQrMenuTitle: 'QR Menyu',
    featureQrMenuDesc: 'Müştərilər masadakı QR kodu skan edib ani şəkildə rəqəmsal menyunuza baxır və sifariş verir.',
    featureOrdersTitle: 'Canlı Sifariş İdarəetməsi',
    featureOrdersDesc: 'Sifarişlər ofisiant və mətbəx panelinə real vaxtda düşür, status addım-addım izlənilir.',
    featureAdminTitle: 'Tam Admin Paneli',
    featureAdminDesc: 'Menyu, kateqoriya, masa, QR kod, sifariş, ödəniş və hesabatları tək yerdən idarə edin.',
    featureLocalizationTitle: 'AZ / EN / RU Dəstəyi',
    featureLocalizationDesc: 'Bütün panellər və müştəri menyusu üç dildə işləyir, dil seçimi avtomatik yadda saxlanılır.',
    featurePaymentsTitle: 'Çevik Ödəniş Seçimləri',
    featurePaymentsDesc: 'Nəğd, kart, Apple Pay və Google Pay dəstəyi ilə müştərilərinizə rahatlıq təqdim edin.',
    featurePromotionsTitle: 'Kampaniya və Banner Sistemi',
    featurePromotionsDesc: 'Endirimlər yaradın, müştəri menyusunun yuxarısında diqqətçəkən bannerlər göstərin.',
    featureAnalyticsTitle: 'Ətraflı Hesabatlar',
    featureAnalyticsDesc: 'Gündəlik gəlir, ən çox satılan məhsullar və masa performansını canlı qrafiklərlə izləyin.',
    featureMultiTenantTitle: 'Çoxrestoranlı İdarəetmə',
    featureMultiTenantDesc: 'Platforma səviyyəsində bütün restoranları, planları və abunəlikləri tək paneldən idarə edin.',

    // Home — Ecosystem
    ecosystemCustomerTitle: 'Müştəri',
    ecosystemCustomerDesc: 'QR kodu skan edir, menyuya baxır, sifariş verir, ofisiantı çağırır — tətbiqsiz.',
    ecosystemStaffTitle: 'Ofisiant / Mətbəx',
    ecosystemStaffDesc: 'Gələn sifarişləri və çağırışları canlı görür, statusları addım-addım yeniləyir.',
    ecosystemAdminTitle: 'Restoran Admini',
    ecosystemAdminDesc: 'Menyunu, masaları, kampaniyaları, dizaynı və hesabatları idarə edir.',
    ecosystemSuperAdminTitle: 'Platforma Admini',
    ecosystemSuperAdminDesc: 'Bütün restoranları, planları və abunəlikləri platforma səviyyəsində idarə edir.',

    // Home — FAQ CTA button (the eyebrow/title above it, and the two sample
    // Q/As, live in site_content/site_faq_items — the sample is now the
    // first 2 real published FAQ rows, not a hand-duplicated copy)
    faqCtaButton: 'Bütün sualları görün',

    // /faq page
    faqPageContactLink: 'Bizimlə əlaqə saxlayın',

    // /demo page
    demoPhoneFrameCaption: 'Nümunə Müştəri Menyusu',
    demoPhoneFrameNote: 'Bu, illüstrativ önizləmədir — real menyunuz öz məhsullarınızla eyni komponentlərdən istifadə edərək görünəcək.',
    demoFeatureListTitle: 'Nə görəcəksiniz',
    demoFeaturePoint1: 'Kateqoriyalara görə filtrlənən, axtarıla bilən menyu',
    demoFeaturePoint2: 'Populyar və Şefin Seçimi kimi diqqətçəkən nişanlar',
    demoFeaturePoint3: 'Səbət, xüsusi istəklər və birbaşa sifariş',
    demoFeaturePoint4: 'Ofisiantı çağırma və hesab istəmə funksiyaları',

    // /contact page
    contactWhatsappTitle: 'WhatsApp',
    contactWhatsappDescription: 'Ən sürətli cavab üçün WhatsApp-dan yazın.',
    contactWhatsappButton: 'WhatsApp-da yaz',
    contactEmailTitle: 'E-poçt',
    contactEmailDescription: 'Ətraflı sual və ya təkliflərinizi e-poçtla göndərin.',
    contactEmailButton: 'E-poçt göndər',
  },
  en: {
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navFaq: 'FAQ',
    navDemo: 'Demo',
    navContact: 'Contact',
    getStartedButton: 'Contact us',
    openMenuAriaLabel: 'Open menu',
    closeMenuAriaLabel: 'Close menu',

    footerTagline: 'A digital QR menu and management platform for your restaurant.',
    footerProductHeading: 'Product',
    footerCompanyHeading: 'Company',
    footerContactHeading: 'Contact',
    footerWhatsappLabel: 'WhatsApp',
    footerEmailLabel: 'Email',
    footerCopyright: (year) => `© ${year} MenuFlow. All rights reserved.`,
    footerLoginLink: 'Sign in',

    metaSiteName: 'MenuFlow',
    metaSiteTitle: 'MenuFlow — QR Menu & Restaurant Management Platform',
    metaSiteDescription: 'QR menus, live order management, kitchen notifications, campaigns, and analytics — all in one platform with MenuFlow.',

    heroTableLabel: 'Table 4',
    heroTicketStatusLabel: 'Sent to kitchen',
    qrShowcasePoint1: 'Instant ordering, no app needed',
    qrShowcasePoint2: 'Live notifications to waiter and kitchen',
    qrShowcasePoint3: 'Menu in AZ / EN / RU',

    seeAllFeaturesLink: 'See all features',

    // /features page section headings — 'Front of House'/'Back of House'
    // is real restaurant vocabulary for the customer-facing vs
    // staff/admin-facing halves of the product
    featuresFrontOfHouseTitle: 'Front of house',
    featuresFrontOfHouseSubtitle: "What the customer sees at the table.",
    featuresBackOfHouseTitle: 'Back of house',
    featuresBackOfHouseSubtitle: 'What staff and admins run behind it.',

    featureQrMenuTitle: 'QR Menu',
    featureQrMenuDesc: 'Customers scan the QR code at their table to instantly view your digital menu and place an order.',
    featureOrdersTitle: 'Live Order Management',
    featureOrdersDesc: 'Orders land on the waiter and kitchen panel in real time, with step-by-step status tracking.',
    featureAdminTitle: 'Full Admin Panel',
    featureAdminDesc: 'Manage your menu, categories, tables, QR codes, orders, payments, and reports from one place.',
    featureLocalizationTitle: 'AZ / EN / RU Support',
    featureLocalizationDesc: 'Every panel and the customer menu work in three languages, and the choice is remembered automatically.',
    featurePaymentsTitle: 'Flexible Payment Options',
    featurePaymentsDesc: 'Offer your customers cash, card, Apple Pay, and Google Pay support.',
    featurePromotionsTitle: 'Campaigns & Banner System',
    featurePromotionsDesc: 'Create discounts and show eye-catching banners at the top of the customer menu.',
    featureAnalyticsTitle: 'Detailed Reports',
    featureAnalyticsDesc: 'Track daily revenue, best-selling items, and table performance with live charts.',
    featureMultiTenantTitle: 'Multi-Restaurant Management',
    featureMultiTenantDesc: 'Manage every restaurant, plan, and subscription platform-wide from a single panel.',

    ecosystemCustomerTitle: 'Customer',
    ecosystemCustomerDesc: 'Scans the QR code, browses the menu, places an order, calls a waiter — no app needed.',
    ecosystemStaffTitle: 'Waiter / Kitchen',
    ecosystemStaffDesc: 'Sees incoming orders and calls live, updating statuses step by step.',
    ecosystemAdminTitle: 'Restaurant Admin',
    ecosystemAdminDesc: 'Manages the menu, tables, campaigns, design, and reports.',
    ecosystemSuperAdminTitle: 'Platform Admin',
    ecosystemSuperAdminDesc: 'Manages every restaurant, plan, and subscription platform-wide.',

    faqCtaButton: 'See all FAQs',

    faqPageContactLink: 'Get in touch',

    demoPhoneFrameCaption: 'Sample Customer Menu',
    demoPhoneFrameNote: 'This is an illustrative preview — your real menu will look like this using your own products.',
    demoFeatureListTitle: "What you'll see",
    demoFeaturePoint1: 'A searchable menu filterable by category',
    demoFeaturePoint2: 'Eye-catching badges like Popular and Chef’s Choice',
    demoFeaturePoint3: 'Cart, special requests, and direct ordering',
    demoFeaturePoint4: 'Call-waiter and request-bill functions',

    contactWhatsappTitle: 'WhatsApp',
    contactWhatsappDescription: 'Message us on WhatsApp for the fastest response.',
    contactWhatsappButton: 'Message on WhatsApp',
    contactEmailTitle: 'Email',
    contactEmailDescription: 'Send us your detailed questions or proposals by email.',
    contactEmailButton: 'Send an email',
  },
  ru: {
    navFeatures: 'Возможности',
    navPricing: 'Тарифы',
    navFaq: 'Вопросы',
    navDemo: 'Демо',
    navContact: 'Контакты',
    getStartedButton: 'Связаться с нами',
    openMenuAriaLabel: 'Открыть меню',
    closeMenuAriaLabel: 'Закрыть меню',

    footerTagline: 'Платформа цифрового QR-меню и управления вашим рестораном.',
    footerProductHeading: 'Продукт',
    footerCompanyHeading: 'Компания',
    footerContactHeading: 'Контакты',
    footerWhatsappLabel: 'WhatsApp',
    footerEmailLabel: 'Email',
    footerCopyright: (year) => `© ${year} MenuFlow. Все права защищены.`,
    footerLoginLink: 'Вход',

    metaSiteName: 'MenuFlow',
    metaSiteTitle: 'MenuFlow — платформа QR-меню и управления рестораном',
    metaSiteDescription: 'QR-меню, управление заказами в реальном времени, уведомления кухни, акции и аналитика — всё в одной платформе с MenuFlow.',

    heroTableLabel: 'Стол 4',
    heroTicketStatusLabel: 'Отправлено на кухню',
    qrShowcasePoint1: 'Мгновенный заказ без приложения',
    qrShowcasePoint2: 'Живые уведомления официанту и кухне',
    qrShowcasePoint3: 'Меню на AZ / EN / RU',

    seeAllFeaturesLink: 'Посмотреть все возможности',

    // Заголовки секций /features — «В зале»/«На кухне» — реальная
    // ресторанная терминология для клиентской и служебной половин продукта
    featuresFrontOfHouseTitle: 'В зале',
    featuresFrontOfHouseSubtitle: 'То, что клиент видит за столом.',
    featuresBackOfHouseTitle: 'На кухне',
    featuresBackOfHouseSubtitle: 'То, чем управляют персонал и администратор.',

    featureQrMenuTitle: 'QR-меню',
    featureQrMenuDesc: 'Клиенты сканируют QR-код за столом и мгновенно видят ваше цифровое меню и оформляют заказ.',
    featureOrdersTitle: 'Управление заказами в реальном времени',
    featureOrdersDesc: 'Заказы поступают в панель официанта и кухни мгновенно, статус отслеживается пошагово.',
    featureAdminTitle: 'Полная панель администратора',
    featureAdminDesc: 'Управляйте меню, категориями, столами, QR-кодами, заказами, платежами и отчётами в одном месте.',
    featureLocalizationTitle: 'Поддержка AZ / EN / RU',
    featureLocalizationDesc: 'Все панели и меню клиента работают на трёх языках, выбор сохраняется автоматически.',
    featurePaymentsTitle: 'Гибкие способы оплаты',
    featurePaymentsDesc: 'Предложите клиентам оплату наличными, картой, Apple Pay и Google Pay.',
    featurePromotionsTitle: 'Система акций и баннеров',
    featurePromotionsDesc: 'Создавайте скидки и показывайте привлекающие внимание баннеры в верхней части меню клиента.',
    featureAnalyticsTitle: 'Подробные отчёты',
    featureAnalyticsDesc: 'Отслеживайте дневной доход, самые продаваемые товары и эффективность столов на живых графиках.',
    featureMultiTenantTitle: 'Управление несколькими ресторанами',
    featureMultiTenantDesc: 'Управляйте всеми ресторанами, тарифами и подписками на уровне платформы из одной панели.',

    ecosystemCustomerTitle: 'Клиент',
    ecosystemCustomerDesc: 'Сканирует QR-код, просматривает меню, оформляет заказ, вызывает официанта — без приложения.',
    ecosystemStaffTitle: 'Официант / Кухня',
    ecosystemStaffDesc: 'Видит входящие заказы и вызовы в реальном времени, пошагово обновляет статусы.',
    ecosystemAdminTitle: 'Администратор ресторана',
    ecosystemAdminDesc: 'Управляет меню, столами, акциями, дизайном и отчётами.',
    ecosystemSuperAdminTitle: 'Администратор платформы',
    ecosystemSuperAdminDesc: 'Управляет всеми ресторанами, тарифами и подписками на уровне платформы.',

    faqCtaButton: 'Все вопросы',

    faqPageContactLink: 'Связаться с нами',

    demoPhoneFrameCaption: 'Пример меню клиента',
    demoPhoneFrameNote: 'Это иллюстративный предпросмотр — ваше настоящее меню будет выглядеть так же, но с вашими товарами.',
    demoFeatureListTitle: 'Что вы увидите',
    demoFeaturePoint1: 'Меню с поиском и фильтрацией по категориям',
    demoFeaturePoint2: 'Заметные значки вроде «Популярное» и «Выбор шефа»',
    demoFeaturePoint3: 'Корзина, особые пожелания и прямой заказ',
    demoFeaturePoint4: 'Функции вызова официанта и запроса счёта',

    contactWhatsappTitle: 'WhatsApp',
    contactWhatsappDescription: 'Напишите нам в WhatsApp для самого быстрого ответа.',
    contactWhatsappButton: 'Написать в WhatsApp',
    contactEmailTitle: 'Email',
    contactEmailDescription: 'Отправьте нам подробные вопросы или предложения по email.',
    contactEmailButton: 'Отправить email',
  },
};

export const useMarketingTranslation = createTranslationHook(marketing);
