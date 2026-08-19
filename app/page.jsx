"use client";

// Public marketing homepage (Master Plan Phase 2/E). Replaces the legacy
// `?role=` role-switcher that used to live here (CLAUDE.md documented it as
// "legacy" and not covered by middleware) — CustomerApp itself is unaffected
// and stays fully reachable via /menu/[restaurant]/[table]; this route only
// drops the query-param dev-testing convenience in favor of a real homepage,
// per explicit instruction.
import React from 'react';
import Link from 'next/link';
import {
  QrCode, UtensilsCrossed, LayoutDashboard, ShieldCheck, Globe2, ArrowRight, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { Card, CardBody, Badge } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { PhoneShowcase } from '@/components/marketing/PhoneShowcase';
import { useMarketingTranslation } from '@/lib/i18n/dictionaries/marketing';

const FEATURE_TEASER = [
  { icon: QrCode, titleKey: 'featureQrMenuTitle', descKey: 'featureQrMenuDesc' },
  { icon: UtensilsCrossed, titleKey: 'featureOrdersTitle', descKey: 'featureOrdersDesc' },
  { icon: LayoutDashboard, titleKey: 'featureAdminTitle', descKey: 'featureAdminDesc' },
  { icon: Globe2, titleKey: 'featureLocalizationTitle', descKey: 'featureLocalizationDesc' },
];

export default function HomePage() {
  const { t } = useMarketingTranslation();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <Badge tone="brand" className="mb-5">{t('heroEyebrow')}</Badge>
          <h1 className="font-serif-title font-bold text-4xl sm:text-5xl leading-tight text-white mb-5">
            {t('heroTitle')}
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
            {t('heroSubtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Points at /contact, not a sign-up form: accounts are created by
                a super admin when the restaurant is set up (see CLAUDE.md ->
                Roles, D1), so "getting started" means reaching out to us. */}
            <Link href="/contact" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'lg' }), 'gap-2')}>
              {t('heroCtaPrimary')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/demo" className={cn(buttonVariants({ context: 'dark', variant: 'secondary', size: 'lg' }))}>
              {t('heroCtaSecondary')}
            </Link>
          </div>
          <p className="text-slate-600 text-xs">{t('heroNote')}</p>
        </div>
        <PhoneShowcase />
      </section>

      {/* QR menu showcase — second, text-led pass over the same idea, mirrors PhoneShowcase already shown above with supporting copy */}
      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <Badge tone="info" className="mb-4">{t('qrShowcaseEyebrow')}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-4">{t('qrShowcaseTitle')}</h2>
            <p className="text-slate-400 leading-relaxed mb-6 max-w-lg">{t('qrShowcaseDescription')}</p>
            <ul className="space-y-3">
              {[t('qrShowcasePoint1'), t('qrShowcasePoint2'), t('qrShowcasePoint3')].map((point) => (
                <li key={point} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                    <QrCode className="w-3.5 h-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-4">{t('qrShowcaseSamplePreview')}</p>
            <PhoneShowcase />
          </div>
        </div>
      </section>

      {/* Features teaser */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge tone="brand" className="mb-4">{t('featuresSectionEyebrow')}</Badge>
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-4">{t('featuresSectionTitle')}</h2>
          <p className="text-slate-400">{t('featuresSectionSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURE_TEASER.map(({ icon: Icon, titleKey, descKey }) => (
            <Card key={titleKey} context="dark" variant="flat">
              <CardBody>
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-white font-bold mb-1.5">{t(titleKey)}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{t(descKey)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/features" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold text-sm transition-colors">
            {t('seeAllFeaturesLink')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge tone="success" className="mb-4">{t('ecosystemEyebrow')}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-4">{t('ecosystemSectionTitle')}</h2>
            <p className="text-slate-400">{t('ecosystemSectionSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: User, titleKey: 'ecosystemCustomerTitle', descKey: 'ecosystemCustomerDesc', tint: 'bg-emerald-500/10 text-emerald-400' },
              { icon: UtensilsCrossed, titleKey: 'ecosystemStaffTitle', descKey: 'ecosystemStaffDesc', tint: 'bg-amber-500/10 text-amber-400' },
              { icon: LayoutDashboard, titleKey: 'ecosystemAdminTitle', descKey: 'ecosystemAdminDesc', tint: 'bg-blue-500/10 text-blue-400' },
              { icon: ShieldCheck, titleKey: 'ecosystemSuperAdminTitle', descKey: 'ecosystemSuperAdminDesc', tint: 'bg-purple-500/10 text-purple-400' },
            ].map(({ icon: Icon, titleKey, descKey, tint }) => (
              <Card key={titleKey} context="dark" variant="elevated">
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
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <Card context="dark" variant="elevated" className="border-[var(--mf-primary)]/30">
          <CardBody className="text-center py-12 sm:py-14 px-6">
            <Badge tone="brand" className="mb-4">{t('pricingCtaEyebrow')}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-3">{t('pricingCtaTitle')}</h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-7">{t('pricingCtaSubtitle')}</p>
            <Link href="/pricing" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'lg' }), 'gap-2')}>
              {t('pricingCtaButton')} <ArrowRight className="w-4 h-4" />
            </Link>
          </CardBody>
        </Card>
      </section>

      {/* FAQ CTA */}
      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <Badge tone="warning" className="mb-4">{t('faqCtaEyebrow')}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white">{t('faqCtaTitle')}</h2>
          </div>
          <div className="space-y-4 mb-10">
            {[
              [t('faqCtaSampleQ1'), t('faqCtaSampleA1')],
              [t('faqCtaSampleQ2'), t('faqCtaSampleA2')],
            ].map(([q, a]) => (
              <Card key={q} context="dark" variant="flat">
                <CardBody>
                  <h3 className="text-white font-bold mb-1.5">{q}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Link href="/faq" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold text-sm transition-colors">
              {t('faqCtaButton')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <Badge tone="info" className="mb-4">{t('contactCtaEyebrow')}</Badge>
        <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-white mb-3">{t('contactCtaTitle')}</h2>
        <p className="text-slate-400 max-w-xl mx-auto mb-7">{t('contactCtaSubtitle')}</p>
        <Link href="/contact" className={cn(buttonVariants({ context: 'dark', variant: 'secondary', size: 'lg' }), 'gap-2')}>
          {t('contactCtaButton')} <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
