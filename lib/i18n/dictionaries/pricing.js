import { createTranslationHook } from '@/lib/i18n';

// app/pricing/page.jsx. AZ values are the exact pre-existing strings — zero
// AZ regression, same convention as every other dictionary in this pass.
// Feature labels (FEATURE_REGISTRY[key].label) are overridden the same way
// RestaurantsTab.jsx/PlansTab.jsx do — see those files' comments — without
// touching lib/services/entitlementService.js itself.
export const pricing = {
  az: {
    homeLink: 'Ana səhifə',
    loadingPrices: 'Qiymətlər yüklənir…',
    loadErrorTitle: 'Yükləmə xətası',
    pageTitle: 'Qiymətləndirmə',
    pageSubtitle: 'Restoranınızın ölçüsünə uyğun planı seçin. Bütün planlar QR menyu, sifariş idarəetməsi və canlı bildirişləri əhatə edir.',
    monthlyTab: 'Aylıq',
    yearlyTab: 'İllik',
    yearlyDiscountBadge: '2 ay pulsuz',
    noPlansFoundTitle: 'Plan tapılmadı',
    noPlansFoundDescription: 'Hazırda heç bir aktiv plan mövcud deyil.',
    mostPopularBadge: 'Ən çox seçilən',
    perYearShort: 'il',
    perMonthShort: 'ay',
    yearlySavingsSuffix: (pct) => `${pct}% qənaət`,
    getStartedButton: 'Başlayın',
    signupFootnote: 'Qeydiyyat hesab yaradır — restoranınız platforma administratoru tərəfindən aktivləşdiriləcək.',
    featureApplePayLabel: 'Apple Pay',
    featureGooglePayLabel: 'Google Pay',
    featureBannersLabel: 'Banner reklamları',
  },
  en: {
    homeLink: 'Home',
    loadingPrices: 'Loading prices…',
    loadErrorTitle: 'Load error',
    pageTitle: 'Pricing',
    pageSubtitle: 'Choose the plan that fits your restaurant. Every plan includes a QR menu, order management, and live notifications.',
    monthlyTab: 'Monthly',
    yearlyTab: 'Yearly',
    yearlyDiscountBadge: '2 months free',
    noPlansFoundTitle: 'No plans found',
    noPlansFoundDescription: 'There are no active plans right now.',
    mostPopularBadge: 'Most popular',
    perYearShort: 'yr',
    perMonthShort: 'mo',
    yearlySavingsSuffix: (pct) => `${pct}% savings`,
    getStartedButton: 'Get started',
    signupFootnote: 'Signing up creates a login — your restaurant will be activated by the platform administrator.',
    featureApplePayLabel: 'Apple Pay',
    featureGooglePayLabel: 'Google Pay',
    featureBannersLabel: 'Banner ads',
  },
  ru: {
    homeLink: 'Главная',
    loadingPrices: 'Загрузка цен…',
    loadErrorTitle: 'Ошибка загрузки',
    pageTitle: 'Тарифы',
    pageSubtitle: 'Выберите тариф, подходящий для вашего ресторана. Каждый тариф включает QR-меню, управление заказами и живые уведомления.',
    monthlyTab: 'Помесячно',
    yearlyTab: 'Ежегодно',
    yearlyDiscountBadge: '2 месяца бесплатно',
    noPlansFoundTitle: 'Тарифы не найдены',
    noPlansFoundDescription: 'Сейчас нет активных тарифов.',
    mostPopularBadge: 'Самый популярный',
    perYearShort: 'год',
    perMonthShort: 'мес',
    yearlySavingsSuffix: (pct) => `экономия ${pct}%`,
    getStartedButton: 'Начать',
    signupFootnote: 'Регистрация создаёт учётную запись — ваш ресторан будет активирован администратором платформы.',
    featureApplePayLabel: 'Apple Pay',
    featureGooglePayLabel: 'Google Pay',
    featureBannersLabel: 'Баннерная реклама',
  },
};

export const usePricingTranslation = createTranslationHook(pricing);
