import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { Badge } from '@/components/mkt';
import { PhoneShowcase } from '@/components/marketing/PhoneShowcase';
import { Reveal } from '@/components/marketing/Reveal';
import { getMarketingDictionary, localeAlternates } from '@/lib/i18n/server';
import { fetchSiteContent, buildSiteContentMap } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  return {
    title: content['demo.hero.title'],
    description: content['demo.hero.subtitle'],
    alternates: {
      canonical: `/${locale}/demo`,
      languages: localeAlternates('demo'),
    },
  };
}

export default async function DemoPage({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 sm:pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge tone="info" className="mb-4">{content['demo.hero.eyebrow']}</Badge>
          <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-[var(--mkt-text)] mb-4">{content['demo.hero.title']}</h1>
          <p className="text-[var(--mkt-text-2)] text-base sm:text-lg">{content['demo.hero.subtitle']}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-center lg:text-left text-xs font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-4">{t('demoPhoneFrameCaption')}</p>
            <PhoneShowcase lang={locale} showCategories />
            <p className="text-center lg:text-left text-[var(--mkt-text-3)] text-xs mt-4 max-w-[300px] mx-auto lg:mx-0">{t('demoPhoneFrameNote')}</p>
          </div>

          <div>
            <h2 className="text-[var(--mkt-text)] font-bold text-xl mb-4">{t('demoFeatureListTitle')}</h2>
            <ul className="space-y-3">
              {[t('demoFeaturePoint1'), t('demoFeaturePoint2'), t('demoFeaturePoint3'), t('demoFeaturePoint4')].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-[var(--mkt-text-2)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--mkt-sage-soft)] text-[var(--mkt-sage)] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Reveal>
      <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface)]/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-3">{content['demo.cta.title']}</h2>
          <p className="text-[var(--mkt-text-2)] mb-7">{content['demo.cta.subtitle']}</p>
          <Link href={`/${locale}/contact`} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
            {content['demo.cta.button']} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      </Reveal>
    </>
  );
}
