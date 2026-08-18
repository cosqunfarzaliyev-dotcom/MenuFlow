"use client";

import React from 'react';
import { MessageCircle, Mail } from 'lucide-react';
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

      {/* The "haven't signed up yet? create a login" section that used to sit
          here is gone along with public sign-up itself — this page IS the way
          to get started now, so a CTA pointing back at it was circular. */}

      <MarketingFooter />
    </div>
  );
}
