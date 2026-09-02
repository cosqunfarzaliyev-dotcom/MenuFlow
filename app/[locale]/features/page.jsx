import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { Badge } from '@/components/mkt';
import { MenuList } from '@/components/marketing/MenuList';
import { Reveal } from '@/components/marketing/Reveal';
import { getMarketingDictionary, localeAlternates } from '@/lib/i18n/server';
import { fetchSiteContent, buildSiteContentMap } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';

// Two real courses, not a generic 8-item icon grid: MenuFlow genuinely has a
// customer-facing half (what a diner sees at the table) and a staff/admin
// half (what runs behind it) — "Zalda" (front of house) / "Mətbəxdə" (back
// of house) is real restaurant vocabulary for exactly that split, so the
// menu metaphor is doing structural work here, not decorating an arbitrary
// grouping. Each course renders via MenuList (components/marketing/
// MenuList.jsx) — the same numbered dot-leader listing the homepage teaser
// uses, not an icon-card grid.
const FRONT_OF_HOUSE = [
  'featureQrMenu', 'featureServiceModels', 'featureLocalization',
  'featureMenuTranslations', 'featurePayments', 'featureTheming', 'featurePromotions',
];
const BACK_OF_HOUSE = ['featureOrders', 'featurePush', 'featureAdmin', 'featurePos', 'featureAnalytics'];

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  return {
    title: content['features.hero.title'],
    description: content['features.hero.subtitle'],
    alternates: {
      canonical: `/${locale}/features`,
      languages: localeAlternates('features'),
    },
  };
}

export default async function FeaturesPage({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);

  const course = (keys) => keys.map((key, i) => ({
    number: String(i + 1).padStart(2, '0'),
    title: t(`${key}Title`),
    description: t(`${key}Desc`),
  }));

  return (
    <>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="brand" className="mb-4">{content['features.hero.eyebrow']}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-[var(--mkt-text)] mb-4">{content['features.hero.title']}</h1>
        <p className="text-[var(--mkt-text-2)] text-base sm:text-lg max-w-2xl mx-auto">{content['features.hero.subtitle']}</p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 space-y-14">
        <Reveal>
        <div>
          <h2 className="font-serif-title text-xl text-[var(--mkt-brass)] mb-1" style={{ fontFamily: 'var(--mkt-font-display)' }}>
            {t('featuresFrontOfHouseTitle')}
          </h2>
          <p className="text-sm text-[var(--mkt-text-3)] mb-5">{t('featuresFrontOfHouseSubtitle')}</p>
          <MenuList items={course(FRONT_OF_HOUSE)} />
        </div>
        </Reveal>
        <Reveal delay={0.1}>
        <div>
          <h2 className="font-serif-title text-xl text-[var(--mkt-brass)] mb-1" style={{ fontFamily: 'var(--mkt-font-display)' }}>
            {t('featuresBackOfHouseTitle')}
          </h2>
          <p className="text-sm text-[var(--mkt-text-3)] mb-5">{t('featuresBackOfHouseSubtitle')}</p>
          <MenuList items={course(BACK_OF_HOUSE)} />
        </div>
        </Reveal>
      </section>

      <Reveal>
      <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface)]/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-3">{content['features.cta.title']}</h2>
          <p className="text-[var(--mkt-text-2)] max-w-xl mx-auto mb-7">{content['features.cta.subtitle']}</p>
          <Link href={`/${locale}/contact`} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
            {content['features.cta.button']} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      </Reveal>
    </>
  );
}
