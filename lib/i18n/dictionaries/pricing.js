import { createTranslationHook } from '@/lib/i18n';

// app/[locale]/pricing/page.jsx (a Server Component — see lib/i18n/server.js's
// getPricingDictionary(), not the client usePricingTranslation() hook below,
// which is now unused by that page and kept only in case a client leaf ever
// needs it). AZ values are the exact pre-existing strings — zero AZ
// regression, same convention as every other dictionary in this pass.
// Feature labels (FEATURE_REGISTRY[key].label) are overridden the same way
// RestaurantsTab.jsx/PlansTab.jsx do — see those files' comments — without
// touching lib/services/entitlementService.js itself.
export const pricing = {
  az: {
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
    featureWalletPayLabel: 'Apple Pay / Google Pay',
    featureBannersLabel: 'Banner reklamları',
    featurePosIntegrationLabel: 'POS inteqrasiyası',
    featurePushNotificationsLabel: 'Push bildirişləri',
  },
  en: {
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
    featureWalletPayLabel: 'Apple Pay / Google Pay',
    featureBannersLabel: 'Banner ads',
    featurePosIntegrationLabel: 'POS integration',
    featurePushNotificationsLabel: 'Push notifications',
  },
  ru: {
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
    featureWalletPayLabel: 'Apple Pay / Google Pay',
    featureBannersLabel: 'Баннерная реклама',
    featurePosIntegrationLabel: 'Интеграция с POS',
    featurePushNotificationsLabel: 'Push-уведомления',
  },
};

export const usePricingTranslation = createTranslationHook(pricing);
