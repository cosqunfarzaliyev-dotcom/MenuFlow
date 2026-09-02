import { LOCALES, DEFAULT_LOCALE, localeAlternates } from '@/lib/i18n/server';

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
      // Same helper the pages' own hreflang tags use (lib/i18n/server.js), so
      // the sitemap's cluster and the <link rel="alternate"> cluster can never
      // disagree — Google cross-checks the two and drops the whole group when
      // they do. Absolute URLs here: a sitemap has no metadataBase to resolve
      // root-relative paths against.
      alternates: { languages: localeAlternates(slug, SITE_URL) },
      // /az is DEFAULT_LOCALE's own copy — pricing.js/marketing.js's `az`
      // block is the source every other locale falls back through
      // (lib/i18n/resolve.js), so it's also the priority=1 entry per slug.
      priority: locale === DEFAULT_LOCALE ? 1 : 0.8,
    })),
  );
}
