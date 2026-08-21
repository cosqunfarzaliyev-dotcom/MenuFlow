import { MessageCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { Card, CardBody, Badge } from '@/components/mkt';
import { Reveal } from '@/components/marketing/Reveal';
import { getMarketingDictionary, LOCALES } from '@/lib/i18n/server';
import { fetchSiteContent, buildSiteContentMap } from '@/lib/services/siteContentService';
import { supabaseServer } from '@/lib/supabase-server';

// No contact-FORM here on purpose — there is no backend/email service
// anywhere in this repo (CLAUDE.md: "There is no backend") to actually
// receive a submission. Real, working channels only: a WhatsApp deep link
// and a mailto: link, both of which genuinely open the visitor's own
// WhatsApp/mail client rather than silently doing nothing on "submit".
//
// contact.whatsapp_url/contact.email come from site_content (Phase 3,
// SuperAdmin-editable) — the SAME values components/marketing/MarketingFooter.jsx
// renders (fetched once in app/[locale]/layout.jsx), so a SuperAdmin edit to
// either changes both places at once.
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);
  return {
    title: content['contact.hero.title'],
    description: content['contact.hero.subtitle'],
    alternates: {
      canonical: `/${locale}/contact`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/contact`])),
    },
  };
}

export default async function ContactPage({ params }) {
  const { locale } = await params;
  const { t } = getMarketingDictionary(locale);
  const contentRows = await fetchSiteContent(supabaseServer);
  const content = buildSiteContentMap(contentRows, locale);

  return (
    <>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="info" className="mb-4">{content['contact.hero.eyebrow']}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-[var(--mkt-text)] mb-4">{content['contact.hero.title']}</h1>
        <p className="text-[var(--mkt-text-2)] text-base sm:text-lg">{content['contact.hero.subtitle']}</p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Reveal>
        <Card variant="elevated">
          <CardBody className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--mkt-sage-soft)] text-[var(--mkt-sage)] flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h2 className="text-[var(--mkt-text)] font-bold text-lg mb-1.5">{t('contactWhatsappTitle')}</h2>
            <p className="text-[var(--mkt-text-2)] text-sm mb-6">{t('contactWhatsappDescription')}</p>
            <a
              href={content['contact.whatsapp_url']}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
            >
              {t('contactWhatsappButton')}
            </a>
          </CardBody>
        </Card>
        </Reveal>

        <Reveal delay={0.1}>
        <Card variant="elevated">
          <CardBody className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--mkt-brass-soft)] text-[var(--mkt-brass)] flex items-center justify-center mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-[var(--mkt-text)] font-bold text-lg mb-1.5">{t('contactEmailTitle')}</h2>
            <p className="text-[var(--mkt-text-2)] text-sm mb-6">{t('contactEmailDescription')}</p>
            <a
              href={`mailto:${content['contact.email']}`}
              className={cn(buttonVariants({ variant: 'secondary', size: 'md' }))}
            >
              {t('contactEmailButton')}
            </a>
          </CardBody>
        </Card>
        </Reveal>
      </section>

      {/* The "haven't signed up yet? create a login" section that used to sit
          here is gone along with public sign-up itself — this page IS the way
          to get started now, so a CTA pointing back at it was circular. */}
    </>
  );
}
