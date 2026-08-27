import Link from 'next/link';
import Image from 'next/image';
import {
  QrCode, UtensilsCrossed, LayoutDashboard, ShieldCheck, Globe2, ArrowRight, User, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { Badge } from '@/components/mkt';
import { TableHero } from '@/components/marketing/TableHero';
import { MenuList } from '@/components/marketing/MenuList';
import { Reveal } from '@/components/marketing/Reveal';
import { getMarketingDictionary } from '@/lib/i18n/server';
import { fetchSiteContent, fetchFaqItems, buildSiteContentMap, resolveFaqItem } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';

// Public marketing homepage. Server Component: every string below is
// resolved once per request/regeneration from the URL's locale segment,
// never from the client languageStore (see app/[locale]/layout.jsx's header
// comment for the full rule this file follows).
//
// STRUCTURE, not just palette: this file's first pass only swapped colors
// and fonts onto the exact same generic "badge / big title / subtitle /
// card grid" shape repeated 7 times — the single most templated SaaS
// pattern there is. This pass breaks that shape section by section:
// TableHero replaces the floating-phone-mockup hero, the QR section is a
// numbered 3-step sequence instead of an icon-bullet list, features render
// as an actual menu listing (MenuList) instead of icon cards, the ecosystem
// section is an asymmetric row instead of 4 identical squares, and the
// three closing CTAs (pricing/FAQ/contact) are one section with three
// distinct visual weights instead of three copies of the same card.
//
// Hero/QR/features-section/ecosystem-section/pricing-CTA/FAQ-CTA/contact-CTA
// copy comes from site_content (`content[...]`, Phase 3) — SuperAdmin-editable.
// The 4 feature-teaser items and 4 ecosystem roles below keep their
// title/desc in marketing.js on purpose (STRUCTURED content — deliberately
// out of the minimal CMS scope; see lib/services/siteContentService.js's
// header for exactly which keys moved).
const FEATURE_TEASER = ['featureQrMenu', 'featureServiceModels', 'featureOrders', 'featureAdmin', 'featureLocalization'];

const ECOSYSTEM_ROLES = [
  { icon: User, titleKey: 'ecosystemCustomerTitle', descKey: 'ecosystemCustomerDesc' },
  { icon: UtensilsCrossed, titleKey: 'ecosystemStaffTitle', descKey: 'ecosystemStaffDesc' },
  { icon: LayoutDashboard, titleKey: 'ecosystemAdminTitle', descKey: 'ecosystemAdminDesc' },
  { icon: ShieldCheck, titleKey: 'ecosystemSuperAdminTitle', descKey: 'ecosystemSuperAdminDesc' },
];

export default async function HomePage({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);
  const href = (slug) => (slug ? `/${locale}/${slug}` : `/${locale}`);

  const [contentRows, faqRows] = await Promise.all([
    fetchSiteContent(supabaseServer),
    fetchFaqItems(supabaseServer, { publishedOnly: true }),
  ]);
  const content = buildSiteContentMap(contentRows, locale);
  // First PUBLISHED FAQ row, in sort_order — the closing section's FAQ
  // column shows one real question (not a card of Q+A) linking through to
  // the full list, so it can never drift out of sync with /[locale]/faq.
  const faqSample = faqRows.slice(0, 1).map((row) => resolveFaqItem(row, locale))[0];

  const ticketLines = {
    status: t('heroTicketStatusLabel'),
    items: [78, 55, 64],
  };

  return (
    <>
      {/* Hero — headline full-width above the table composition, not a
          50/50 text-left/image-right split (the most generic possible
          hero shape). Only the TEXT block sits on the photo backdrop (a
          real restaurant interior, not a stock-gradient) — the scrim
          resolves to fully solid cream by the section's bottom edge, so
          TableHero below sits on plain --mkt-ground, exactly like the
          same PhoneShowcase mockup does on /demo. Keeping "the demo view"
          on one consistent background wherever it appears mattered more
          than stretching the photo behind it too. */}
      <div className="relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80"
          alt=""
          fill
          unoptimized
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--mkt-ground)] via-[var(--mkt-ground)]/85 to-[var(--mkt-ground)]" />

        <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
          <Badge tone="brand" className="mb-5">{content['home.hero.eyebrow']}</Badge>
          <h1 className="font-serif-title font-bold text-4xl sm:text-6xl leading-[1.05] text-[var(--mkt-text)] mb-5">
            {content['home.hero.title']}
          </h1>
          <p className="text-[var(--mkt-text-2)] text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            {content['home.hero.subtitle']}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            {/* Points at /contact, not a sign-up form: accounts are created by
                a super admin when the restaurant is set up (see CLAUDE.md ->
                Roles, D1), so "getting started" means reaching out to us. */}
            <Link href={href('contact')} className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}>
              {content['home.hero.cta_primary']} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href={href('demo')} className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}>
              {content['home.hero.cta_secondary']}
            </Link>
          </div>
          <p className="text-[var(--mkt-text-3)] text-xs">{content['home.hero.note']}</p>
        </section>
      </div>

      <TableHero lang={locale} tableLabel={t('heroTableLabel')} ticketLines={ticketLines} />

      {/* QR flow — a numbered 3-step sequence (the sequence is REAL: scan,
          then order, then it's served — order carries information here,
          unlike a decorative 01/02/03 on non-sequential content), not an
          icon-bullet list next to a second phone mockup. */}
      <Reveal>
      <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface)]/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-xl mx-auto mb-12">
            <Badge tone="info" className="mb-4">{content['home.qr.eyebrow']}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-4">{content['home.qr.title']}</h2>
            <p className="text-[var(--mkt-text-2)] leading-relaxed">{content['home.qr.subtitle']}</p>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6">
            {/* connecting line — desktop only, sits behind the three steps */}
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-[var(--mkt-line)] sm:block" aria-hidden="true" />
            {[t('qrShowcasePoint1'), t('qrShowcasePoint2'), t('qrShowcasePoint3')].map((point, i) => (
              <div key={point} className="relative text-center sm:text-left">
                <span
                  className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--mkt-brass)] bg-[var(--mkt-brass-soft)] font-serif-title text-lg text-[var(--mkt-brass)]"
                  style={{ fontFamily: 'var(--mkt-font-display)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-4 text-sm leading-relaxed text-[var(--mkt-text-2)] sm:max-w-[220px]">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Features — an actual menu listing, not an icon-card grid. */}
      <Reveal>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-xl mx-auto mb-10">
          <Badge tone="brand" className="mb-4">{content['home.features.eyebrow']}</Badge>
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-4">{content['home.features.title']}</h2>
          <p className="text-[var(--mkt-text-2)]">{content['home.features.subtitle']}</p>
        </div>
        <MenuList
          items={FEATURE_TEASER.map((key, i) => ({
            number: String(i + 1).padStart(2, '0'),
            title: t(`${key}Title`),
            description: t(`${key}Desc`),
          }))}
        />
        <div className="text-center mt-8">
          <Link href={href('features')} className="inline-flex items-center gap-1.5 text-[var(--mkt-brass)] hover:text-[var(--mkt-brass-hover)] font-bold text-sm transition-colors">
            {t('seeAllFeaturesLink')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      </Reveal>

      {/* Ecosystem — one wide strip with 4 unequal-width seats at the same
          table, divided by hairlines, instead of 4 identical square cards.
          Each role's icon sits in its own lane at a different vertical
          rhythm (staggered translate-y) so the row doesn't read as a grid
          either. */}
      <Reveal>
      <section className="border-t border-[var(--mkt-line)] bg-[var(--mkt-surface)]/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-xl mx-auto mb-12">
            <Badge tone="success" className="mb-4">{content['home.ecosystem.eyebrow']}</Badge>
            <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-4">{content['home.ecosystem.title']}</h2>
            <p className="text-[var(--mkt-text-2)]">{content['home.ecosystem.subtitle']}</p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-[var(--mkt-line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
            {ECOSYSTEM_ROLES.map(({ icon: Icon, titleKey, descKey }, i) => (
              <div key={titleKey} className={cn('px-0 py-6 sm:px-6 sm:py-0', i % 2 === 1 && 'sm:translate-y-6')}>
                <Icon className="h-6 w-6 text-[var(--mkt-brass)] mb-3" aria-hidden="true" />
                <h3 className="text-[var(--mkt-text)] font-bold mb-1.5">{t(titleKey)}</h3>
                <p className="text-[var(--mkt-text-2)] text-sm leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Closing — pricing/FAQ/contact consolidated into ONE section with
          three distinct visual treatments (a price figure, one real
          question, a direct send-message action) instead of three stacked
          copies of the same badge+title+subtitle+button card. */}
      <Reveal>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-3">{content['home.pricing_cta.title']}</h2>
          <p className="text-[var(--mkt-text-2)]">{content['home.pricing_cta.subtitle']}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 border-t border-[var(--mkt-line)] pt-10">
          {/* Pricing — the number does the talking */}
          <Link href={href('pricing')} className="group block">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-2">{content['home.pricing_cta.eyebrow']}</p>
            <p className="font-serif-title text-4xl text-[var(--mkt-text)] mb-2" style={{ fontFamily: 'var(--mkt-font-display)' }}>
              {content['home.pricing_cta.button']}
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--mkt-brass)] group-hover:text-[var(--mkt-brass-hover)]">
              {t('seeAllFeaturesLink')} <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          {/* FAQ — one real, live question */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-2">{content['home.faq_cta.eyebrow']}</p>
            {faqSample ? (
              <>
                <p className="text-[var(--mkt-text)] font-semibold mb-1.5 leading-snug">{faqSample.question}</p>
                <p className="text-sm text-[var(--mkt-text-2)] leading-relaxed line-clamp-2 mb-2">{faqSample.answer}</p>
              </>
            ) : (
              <p className="text-[var(--mkt-text)] font-semibold mb-2">{content['home.faq_cta.title']}</p>
            )}
            <Link href={href('faq')} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--mkt-brass)] hover:text-[var(--mkt-brass-hover)]">
              {t('faqCtaButton')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Contact — a direct action, not another headline+button pair */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-2">{content['home.contact_cta.eyebrow']}</p>
            <p className="text-[var(--mkt-text)] font-semibold mb-4 leading-snug">{content['home.contact_cta.subtitle']}</p>
            <Link href={href('contact')} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}>
              <Send className="w-3.5 h-3.5" /> {content['home.contact_cta.button']}
            </Link>
          </div>
        </div>
      </section>
      </Reveal>
    </>
  );
}
