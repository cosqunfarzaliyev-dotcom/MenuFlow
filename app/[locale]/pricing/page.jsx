import { fetchPlans, fetchPlanFeatures } from '@/lib/services/planService';
import { FEATURE_REGISTRY, FEATURE_KEYS } from '@/lib/services/entitlementService';
import { supabaseServer } from '@/lib/supabase-server';
import { getPricingDictionary, localeAlternates } from '@/lib/i18n/server';
import { fetchSiteContent, buildSiteContentMap } from '@/lib/services/siteContentService';
import { PricingToggle } from '@/components/marketing/PricingToggle';

// Public marketing pricing page. Reads plans/plan_features via
// lib/services/planService.js — the exact same functions lib/store.js's
// loadPlans() calls to hydrate the entitlement resolver (see
// entitlementService.js's hydratePlanFeatureDefaults) — so this page and
// every hasFeature()/getEntitlements() check across the app are provably
// reading the same plan source, not two copies that can drift. Passes
// `supabaseServer` (lib/supabase-server.js, always-anonymous) rather than
// the browser `supabase` client, since a Server Component has no session to
// carry anyway and both `plans`/`plan_features` are public-read regardless.
//
// Server Component: all data fetching AND all string/label resolution
// happens here; the only client-side piece is PricingToggle, which owns
// just the billingInterval UI state and receives fully-prepared,
// serializable props (see that file's header comment for why — functions,
// including pricing.js's yearlySavingsSuffix(pct), cannot cross the
// Server -> Client Component boundary).

// Same override approach as RestaurantsTab.jsx/PlansTab.jsx — see those
// files' comments — without touching lib/services/entitlementService.js.
// MUST cover every FEATURE_KEYS entry — the fallback at the call site is
// `t(FEATURE_LABEL_KEYS[key] || key)`, and createTranslationHook's own last
// resort is the raw key, so a feature missing here renders as a literal
// `pos_integration` on the public pricing page rather than failing loudly.
// (That is exactly what happened when POS_INTEGRATION/PUSH_NOTIFICATIONS
// were added to entitlementService.js without updating this map.)
const FEATURE_LABEL_KEYS = {
  wallet_pay: 'featureWalletPayLabel',
  banners: 'featureBannersLabel',
  pos_integration: 'featurePosIntegrationLabel',
  push_notifications: 'featurePushNotificationsLabel',
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  return {
    title: content['pricing.hero.title'],
    description: content['pricing.hero.subtitle'],
    alternates: {
      canonical: `/${locale}/pricing`,
      languages: localeAlternates('pricing'),
    },
  };
}

export default async function PricingPage({ params }) {
  const { locale } = await params;
  const { t } = getPricingDictionary(locale);

  const [plans, planFeatures, contentRows] = await Promise.all([
    fetchPlans(supabaseServer),
    fetchPlanFeatures(supabaseServer),
    fetchSiteContent(supabaseServer),
  ]);
  const content = buildSiteContentMap(contentRows, locale);

  // plan_id -> { feature_key: enabled } — grouped once so each plan card
  // below is an O(1) lookup per feature row instead of filtering the whole
  // array per card.
  const featuresByPlanId = {};
  for (const row of planFeatures) {
    if (!featuresByPlanId[row.plan_id]) featuresByPlanId[row.plan_id] = {};
    featuresByPlanId[row.plan_id][row.feature_key] = row.enabled === true;
  }

  const planViewModels = plans.map((plan) => {
    const priceMonthly = plan.price_monthly;
    const priceYearly = plan.price_yearly;
    // "N% qənaət" — only shown when the yearly price is actually a discount
    // off 12x the monthly price (true for the seeded plans; guards against a
    // future plan priced without a yearly discount).
    const yearlySavingsPct = priceMonthly > 0
      ? Math.round((1 - Number(priceYearly) / (Number(priceMonthly) * 12)) * 100)
      : 0;

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceMonthly,
      priceYearly,
      currency: plan.currency,
      isFeatured: plan.key === 'pro',
      // The function itself (t('yearlySavingsSuffix')) is called HERE,
      // server-side, once per plan — only the resulting STRING is handed to
      // the client leaf.
      yearlySavingsLabel: yearlySavingsPct > 0 ? t('yearlySavingsSuffix')(yearlySavingsPct) : null,
      features: FEATURE_KEYS.map((key) => ({
        key,
        label: t(FEATURE_LABEL_KEYS[key] || key),
        enabled: featuresByPlanId[plan.id]?.[key] ?? FEATURE_REGISTRY[key].defaultEnabled,
      })),
    };
  });

  const labels = {
    pageTitle: content['pricing.hero.title'],
    pageSubtitle: content['pricing.hero.subtitle'],
    monthlyTab: t('monthlyTab'),
    yearlyTab: t('yearlyTab'),
    yearlyDiscountBadge: t('yearlyDiscountBadge'),
    noPlansFoundTitle: t('noPlansFoundTitle'),
    noPlansFoundDescription: t('noPlansFoundDescription'),
    mostPopularBadge: t('mostPopularBadge'),
    perYearShort: t('perYearShort'),
    perMonthShort: t('perMonthShort'),
    getStartedButton: t('getStartedButton'),
    signupFootnote: t('signupFootnote'),
  };

  return (
    <PricingToggle plans={planViewModels} labels={labels} contactHref={`/${locale}/contact`} />
  );
}
