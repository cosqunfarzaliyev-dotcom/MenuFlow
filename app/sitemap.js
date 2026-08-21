import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/server';

// One entry per (page, locale) — 6 pages x 3 locales = 18 URLs, each with a
// full `alternates.languages` map so a crawler landing on any one locale's
// URL discovers the other two directly, matching the hreflang tags
// generateMetadata() emits per-page (app/[locale]/**/page.jsx).
const SLUGS = ['', 'pricing', 'features', 'faq', 'demo', 'contact'];

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://menuflow.az').replace(/\/$/, '');

const pathFor = (locale, slug) => (slug ? `/${locale}/${slug}` : `/${locale}`);

export default function sitemap() {
  const lastModified = new Date();

  return LOCALES.flatMap((locale) =>
    SLUGS.map((slug) => ({
      url: `${SITE_URL}${pathFor(locale, slug)}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pathFor(l, slug)}`])),
      },
      // /az is DEFAULT_LOCALE's own copy — pricing.js/marketing.js's `az`
      // block is the source every other locale falls back through
      // (lib/i18n/resolve.js), so it's also the priority=1 entry per slug.
      priority: locale === DEFAULT_LOCALE ? 1 : 0.8,
    })),
  );
}
