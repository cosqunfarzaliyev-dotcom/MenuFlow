import { notFound } from 'next/navigation';
import { LOCALES, isLocale, getMarketingDictionary } from '@/lib/i18n/server';
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

  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}`]));

  return {
    title: { default: t('metaSiteTitle'), template: `%s · ${t('metaSiteName')}` },
    description: t('metaSiteDescription'),
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    openGraph: {
      siteName: t('metaSiteName'),
      locale,
      type: 'website',
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

  return (
    <div className="mkt min-h-screen">
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
