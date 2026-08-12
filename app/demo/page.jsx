"use client";

import React from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { Badge } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PhoneShowcase } from '@/components/marketing/PhoneShowcase';
import { useMarketingTranslation } from '@/lib/i18n/dictionaries/marketing';

export default function DemoPage() {
  const { t } = useMarketingTranslation();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge tone="info" className="mb-4">{t('demoPageEyebrow')}</Badge>
          <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-white mb-4">{t('demoPageTitle')}</h1>
          <p className="text-slate-400 text-base sm:text-lg">{t('demoPageSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-center lg:text-left text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">{t('demoPhoneFrameCaption')}</p>
            <PhoneShowcase />
            <p className="text-center lg:text-left text-slate-600 text-xs mt-4 max-w-[300px] mx-auto lg:mx-0">{t('demoPhoneFrameNote')}</p>
          </div>

          <div>
            <h2 className="text-white font-bold text-xl mb-4">{t('demoFeatureListTitle')}</h2>
            <ul className="space-y-3">
              {[t('demoFeaturePoint1'), t('demoFeaturePoint2'), t('demoFeaturePoint3'), t('demoFeaturePoint4')].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-3">{t('demoCtaTitle')}</h2>
          <p className="text-slate-400 mb-7">{t('demoCtaSubtitle')}</p>
          <Link href="/contact" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'lg' }), 'gap-2')}>
            {t('demoCtaButton')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
