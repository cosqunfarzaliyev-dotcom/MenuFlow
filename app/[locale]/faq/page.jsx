import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/mkt';
import { getMarketingDictionary, LOCALES } from '@/lib/i18n/server';
import { fetchSiteContent, fetchFaqItems, buildSiteContentMap, resolveFaqItem } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';
import { FaqAccordionList } from '@/components/marketing/FaqAccordionList';
import { Reveal } from '@/components/marketing/Reveal';

// FAQ questions/answers come from site_faq_items (supabase/migrations/
// 0032_site_content_cms.sql) — SuperAdmin-editable (add/edit/delete/reorder,
// Phase 4). Only PUBLISHED rows render here; SiteFaqTab manages drafts too.

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  return {
    title: content['faq.hero.title'],
    description: content['faq.hero.subtitle'],
    alternates: {
      canonical: `/${locale}/faq`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/faq`])),
    },
  };
}

export default async function FaqPage({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);
  const contactHref = `/${locale}/contact`;

  const [contentRows, faqRows] = await Promise.all([
    fetchSiteContent(supabaseServer),
    fetchFaqItems(supabaseServer, { publishedOnly: true }),
  ]);
  const content = buildSiteContentMap(contentRows, locale);
  const items = faqRows.map((row) => resolveFaqItem(row, locale));

  return (
    <>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="warning" className="mb-4">{content['faq.hero.eyebrow']}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-[var(--mkt-text)] mb-4">{content['faq.hero.title']}</h1>
        <p className="text-[var(--mkt-text-2)] text-base sm:text-lg">
          {content['faq.hero.subtitle']}{' '}
          <Link href={contactHref} className="text-[var(--mkt-brass)] hover:text-[var(--mkt-brass-hover)] font-bold">{t('faqPageContactLink')}</Link>
        </p>
      </section>

      <Reveal>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <FaqAccordionList items={items} defaultOpenId={items[0]?.id ?? null} />
      </section>
      </Reveal>

      <Reveal>
      <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface)]/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
          <p className="text-[var(--mkt-text-2)] mb-4">{content['faq.hero.subtitle']}</p>
          <Link href={contactHref} className="inline-flex items-center gap-1.5 text-[var(--mkt-brass)] hover:text-[var(--mkt-brass-hover)] font-bold text-sm transition-colors">
            {t('faqPageContactLink')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      </Reveal>
    </>
  );
}
