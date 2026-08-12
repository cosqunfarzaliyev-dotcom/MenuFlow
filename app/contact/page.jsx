"use client";

import React from 'react';
import Link from 'next/link';
import { MessageCircle, Mail, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/variants';
import { Card, CardBody, Badge } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { useMarketingTranslation, CONTACT_WHATSAPP_URL, CONTACT_EMAIL } from '@/lib/i18n/dictionaries/marketing';

// No contact-FORM here on purpose — there is no backend/email service
// anywhere in this repo (CLAUDE.md: "There is no backend") to actually
// receive a submission. Real, working channels only: a WhatsApp deep link
// and a mailto: link, both of which genuinely open the visitor's own
// WhatsApp/mail client rather than silently doing nothing on "submit".
export default function ContactPage() {
  const { t } = useMarketingTranslation();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="info" className="mb-4">{t('contactPageEyebrow')}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-white mb-4">{t('contactPageTitle')}</h1>
        <p className="text-slate-400 text-base sm:text-lg">{t('contactPageSubtitle')}</p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card context="dark" variant="elevated">
          <CardBody className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h2 className="text-white font-bold text-lg mb-1.5">{t('contactWhatsappTitle')}</h2>
            <p className="text-slate-400 text-sm mb-6">{t('contactWhatsappDescription')}</p>
            <a
              href={CONTACT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'md' }))}
            >
              {t('contactWhatsappButton')}
            </a>
          </CardBody>
        </Card>

        <Card context="dark" variant="elevated">
          <CardBody className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h2 className="text-white font-bold text-lg mb-1.5">{t('contactEmailTitle')}</h2>
            <p className="text-slate-400 text-sm mb-6">{t('contactEmailDescription')}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={cn(buttonVariants({ context: 'dark', variant: 'secondary', size: 'md' }))}
            >
              {t('contactEmailButton')}
            </a>
          </CardBody>
        </Card>
      </section>

      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-serif-title font-bold text-2xl sm:text-3xl text-white mb-3">{t('contactAlsoTitle')}</h2>
          <p className="text-slate-400 mb-7">{t('contactAlsoSubtitle')}</p>
          <Link href="/login?mode=signup" className={cn(buttonVariants({ context: 'dark', variant: 'primary', size: 'lg' }), 'gap-2')}>
            {t('contactAlsoButton')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
