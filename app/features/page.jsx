"use client";

import React from 'react';
import Link from 'next/link';
import {
  QrCode, UtensilsCrossed, LayoutDashboard, Globe2, Wallet,
  Megaphone, BarChart3, ShieldCheck, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { Card, CardBody, Badge } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { useMarketingTranslation } from '@/lib/i18n/dictionaries/marketing';

const FEATURES = [
  { icon: QrCode, titleKey: 'featureQrMenuTitle', descKey: 'featureQrMenuDesc', tint: 'bg-blue-500/10 text-blue-400' },
  { icon: UtensilsCrossed, titleKey: 'featureOrdersTitle', descKey: 'featureOrdersDesc', tint: 'bg-amber-500/10 text-amber-400' },
  { icon: LayoutDashboard, titleKey: 'featureAdminTitle', descKey: 'featureAdminDesc', tint: 'bg-purple-500/10 text-purple-400' },
  { icon: Globe2, titleKey: 'featureLocalizationTitle', descKey: 'featureLocalizationDesc', tint: 'bg-emerald-500/10 text-emerald-400' },
  { icon: Wallet, titleKey: 'featurePaymentsTitle', descKey: 'featurePaymentsDesc', tint: 'bg-cyan-500/10 text-cyan-400' },
  { icon: Megaphone, titleKey: 'featurePromotionsTitle', descKey: 'featurePromotionsDesc', tint: 'bg-rose-500/10 text-rose-400' },
  { icon: BarChart3, titleKey: 'featureAnalyticsTitle', descKey: 'featureAnalyticsDesc', tint: 'bg-indigo-500/10 text-indigo-400' },
  { icon: ShieldCheck, titleKey: 'featureMultiTenantTitle', descKey: 'featureMultiTenantDesc', tint: 'bg-orange-500/10 text-orange-400' },
];

export default function FeaturesPage() {
  const { t } = useMarketingTranslation();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="brand" className="mb-4">{t('featuresPageEyebrow')}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-white mb-4">{t('featuresPageTitle')}</h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">{t('featuresPageSubtitle')}</p>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, titleKey, descKey, tint }) => (
            <Card key={titleKey} context="dark" variant="flat">
              <CardBody>
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center mb-4', tint)}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-white font-bold mb-1.5">{t(titleKey)}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{t(descKey)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-3">{t('featuresPageCtaTitle')}</h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-7">{t('featuresPageCtaSubtitle')}</p>
          <Link href="/login?mode=signup" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'lg' }), 'gap-2')}>
            {t('featuresPageCtaButton')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
