import { notFound } from 'next/navigation';
import { LOCALES, isLocale, getMarketingDictionary, localeAlternates } from '@/lib/i18n/server';
import { fetchSiteContent, buildSiteContentMap } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

// ============================================================================
// Public marketing site — locale root.
// ============================================================================
// INVARIANT, load-bearing: the four app panels (/admin, /staff, /superadmin)
// plus /login, /superadmin-login, /reset-password, /onboarding, /menu, /stuff
// all live OUTSIDE this [locale] segment. middleware.js's matcher
// (["/admin/:path*","/staff/:path*","/superadmin/:path*","/onboarding/:path*"])
// therefore never sees a locale-prefixed path, and none of those routes can
// ever accidentally gain a /az/ /en/ /ru/ prefix — that would require
// physically moving a panel's route folder under app/[locale]/, which no
// change described here does. If a future edit ever needs to move a panel
// under this segment, middleware.js's matcher must be updated in the same
// change, not after.
//
// `dynamicParams = false` is equally load-bearing: without it, an unknown
// path like /blog would render as `locale: 'blog'` (a 200 with home-page
// content) instead of a real 404. Every locale this app supports is listed
// in generateStaticParams below; anything else 404s.
// ============================================================================

// Absolute origin for the JSON-LD graph below. metadataBase (app/layout.jsx)
// resolves the root-relative paths in `metadata`, but schema.org @id/url
// values are raw strings Next never touches, so they need the origin spelled
// out — same fallback as robots.js/sitemap.js, kept identical on purpose.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://menuflow.az').replace(/\/$/, '');

export const dynamicParams = false;

// Re-render at most every 15 minutes so a SuperAdmin CMS edit
// (lib/site-content/publish.js, Phase 4) becomes visible without a full
// redeploy — see that file's header for the immediate-publish path.
export const revalidate = 900;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = getMarketingDictionary(locale);

  return {
    title: { default: t('metaSiteTitle'), template: `%s · ${t('metaSiteName')}` },
    description: t('metaSiteDescription'),
    // Overrides the root layout's default noindex (app/layout.jsx) — this is
    // the one segment actually meant to rank.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        // Without these three Google truncates the snippet, refuses a large
        // thumbnail, and skips video previews entirely — they are opt-IN,
        // and their absence (not a "noindex") is why a correctly-indexed
        // page can still render as a bare blue link with no image.
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    alternates: {
      canonical: `/${locale}`,
      languages: localeAlternates(),
    },
    openGraph: {
      siteName: t('metaSiteName'),
      locale,
      type: 'website',
      title: t('metaSiteTitle'),
      description: t('metaSiteDescription'),
      url: `/${locale}`,
    },
    // opengraph-image.jsx is picked up automatically for `openGraph.images`,
    // but NOT for Twitter's own card — `summary_large_image` without this
    // block degrades to a small square thumbnail on X/Slack/WhatsApp.
    twitter: {
      card: 'summary_large_image',
      title: t('metaSiteTitle'),
      description: t('metaSiteDescription'),
    },
  };
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Footer needs exactly three site_content values (contact.whatsapp_url,
  // contact.email, contact.instagram_url) — fetched here rather than inside
  // MarketingFooter itself so the component stays a plain, props-only
  // Server Component with no data-fetching of its own.
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  const { t } = getMarketingDictionary(locale);

  // Structured data. `metadata` above gives Google the <title>/<meta> pair it
  // needs to RANK the page; this is what lets it understand the page as a
  // named product from a named company — the input for a knowledge panel and
  // for sitelinks, neither of which plain meta tags can produce.
  //
  // Two graph nodes, both derived from values that already exist (the i18n
  // meta strings, the same site_content contact rows the footer renders), so
  // a SuperAdmin CMS edit updates the markup and the visible footer together
  // and they cannot drift apart. `sameAs`/`email` are omitted entirely when
  // unset rather than emitted blank — Google treats an empty required
  // property as invalid markup, which is worse than a smaller valid graph.
  const orgId = `${SITE_URL}/#organization`;
  const organization = {
    '@type': 'Organization',
    '@id': orgId,
    name: t('metaSiteName'),
    url: `${SITE_URL}/${locale}`,
    description: t('metaSiteDescription'),
    logo: `${SITE_URL}/icons/icon-512.png`,
    ...(content['contact.instagram_url'] ? { sameAs: [content['contact.instagram_url']] } : {}),
    ...(content['contact.email']
      ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: content['contact.email'] } }
      : {}),
  };
  const softwareApplication = {
    '@type': 'SoftwareApplication',
    name: t('metaSiteName'),
    url: `${SITE_URL}/${locale}`,
    description: t('metaSiteDescription'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: LOCALES,
    publisher: { '@id': orgId },
  };
  const jsonLd = { '@context': 'https://schema.org', '@graph': [organization, softwareApplication] };

  return (
    <div className="mkt min-h-screen">
      <script
        type="application/ld+json"
        // Values are our own i18n strings and SuperAdmin-authored site_content,
        // never visitor input; JSON.stringify is the serializer Google's own
        // docs prescribe for this tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader locale={locale} />
      {children}
      <MarketingFooter
        locale={locale}
        whatsappUrl={content['contact.whatsapp_url']}
        email={content['contact.email']}
        instagramUrl={content['contact.instagram_url']}
      />
    </div>
  );
}
