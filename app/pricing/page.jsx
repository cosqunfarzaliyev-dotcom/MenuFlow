"use client";

// Public marketing pricing page (Master Plan Phase 2/E — the first page of
// the "public marketing website" that CLAUDE.md documents as not existing
// yet). Reads plans/plan_features directly from lib/services/planService.js
// — the exact same functions lib/store.js's loadPlans() calls to hydrate the
// entitlement resolver (see entitlementService.js's hydratePlanFeatureDefaults) —
// so this page and every hasFeature()/getEntitlements() check across the app
// are provably reading the same plan source, not two copies that can drift.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { fetchPlans, fetchPlanFeatures } from '@/lib/services/planService';
import { FEATURE_REGISTRY, FEATURE_KEYS } from '@/lib/services/entitlementService';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { Card, CardBody, Badge, Tabs, TabsTrigger, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { usePricingTranslation } from '@/lib/i18n/dictionaries/pricing';

// Same override approach as RestaurantsTab.jsx/PlansTab.jsx — see those
// files' comments — without touching lib/services/entitlementService.js.
const FEATURE_LABEL_KEYS = {
  apple_pay: 'featureApplePayLabel',
  google_pay: 'featureGooglePayLabel',
  banners: 'featureBannersLabel',
};

export default function PricingPage() {
  const { t } = usePricingTranslation();
  const [plans, setPlans] = useState([]);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [billingInterval, setBillingInterval] = useState('monthly'); // 'monthly' | 'yearly'
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [plansData, featuresData] = await Promise.all([fetchPlans(), fetchPlanFeatures()]);
        if (!active) return;
        setPlans(plansData);
        setPlanFeatures(featuresData);
      } catch (err) {
        if (!active) return;
        console.error('PricingPage load error:', err);
        setLoadError(err?.message || String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  // plan_id -> { feature_key: enabled } — grouped once so each plan card
  // just does an O(1) lookup per feature row instead of filtering the whole
  // array per card.
  const featuresByPlanId = useMemo(() => {
    const map = {};
    for (const row of planFeatures) {
      if (!map[row.plan_id]) map[row.plan_id] = {};
      map[row.plan_id][row.feature_key] = row.enabled === true;
    }
    return map;
  }, [planFeatures]);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      {loading ? (
        <LoadingState title={t('loadingPrices')} />
      ) : loadError ? (
        <ErrorState title={t('loadErrorTitle')} description={loadError} onRetry={() => window.location.reload()} />
      ) : (
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-3">{t('pageTitle')}</h1>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            {t('pageSubtitle')}
          </p>

          <Tabs className="inline-flex">
            <TabsTrigger active={billingInterval === 'monthly'} onClick={() => setBillingInterval('monthly')}>
              {t('monthlyTab')}
            </TabsTrigger>
            <TabsTrigger active={billingInterval === 'yearly'} onClick={() => setBillingInterval('yearly')}>
              {t('yearlyTab')}
              <Badge tone="success" className="ml-1">{t('yearlyDiscountBadge')}</Badge>
            </TabsTrigger>
          </Tabs>
        </div>

        {plans.length === 0 ? (
          <EmptyState title={t('noPlansFoundTitle')} description={t('noPlansFoundDescription')} />
        ) : (
          <div className={cn('grid gap-6 max-w-3xl mx-auto', plans.length > 1 ? 'sm:grid-cols-2' : 'sm:max-w-sm')}>
            {plans.map((plan) => {
              const price = billingInterval === 'yearly' ? plan.price_yearly : plan.price_monthly;
              const isFeatured = plan.key === 'pro';
              // "N% qənaət" — only shown when the yearly price is actually a
              // discount off 12x the monthly price (true for the seeded
              // plans; guards against a future plan priced without a
              // yearly discount).
              const yearlySavingsPct = plan.price_monthly > 0
                ? Math.round((1 - Number(plan.price_yearly) / (Number(plan.price_monthly) * 12)) * 100)
                : 0;

              return (
                <Card
                  key={plan.id}
                  variant={isFeatured ? 'elevated' : 'flat'}
                  className={cn('relative flex flex-col', isFeatured && 'border-[var(--mf-primary)]/50')}
                >
                  {isFeatured && (
                    <Badge tone="brand" className="absolute -top-3 left-1/2 -translate-x-1/2">{t('mostPopularBadge')}</Badge>
                  )}
                  <CardBody className="flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    {plan.description && <p className="text-sm text-slate-400 mb-4">{plan.description}</p>}

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black text-white">{price}</span>
                      <span className="text-sm text-slate-500">
                        {plan.currency} / {billingInterval === 'yearly' ? t('perYearShort') : t('perMonthShort')}
                      </span>
                    </div>
                    {billingInterval === 'yearly' && yearlySavingsPct > 0 && (
                      <p className="text-xs text-emerald-400 font-bold mt-1 mb-4">{t('yearlySavingsSuffix')(yearlySavingsPct)}</p>
                    )}
                    {!(billingInterval === 'yearly' && yearlySavingsPct > 0) && <div className="mb-4" />}

                    <ul className="space-y-2.5 flex-1">
                      {FEATURE_KEYS.map((key) => {
                        const enabled = featuresByPlanId[plan.id]?.[key] ?? FEATURE_REGISTRY[key].defaultEnabled;
                        return (
                          <li key={key} className="flex items-center gap-2.5 text-sm">
                            {enabled ? (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-slate-700 shrink-0" />
                            )}
                            <span className={enabled ? 'text-slate-200' : 'text-slate-600 line-through'}>
                              {t(FEATURE_LABEL_KEYS[key] || key)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    <Link
                      href="/contact"
                      className={cn(buttonVariants({ variant: isFeatured ? 'primary' : 'secondary', size: 'block' }), 'mt-6')}
                    >
                      {t('getStartedButton')}
                    </Link>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-10">
          {t('signupFootnote')}
        </p>
      </div>
      )}

      <MarketingFooter />
    </div>
  );
}
