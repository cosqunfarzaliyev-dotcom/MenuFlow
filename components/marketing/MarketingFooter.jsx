"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, Mail } from 'lucide-react';
import { useMarketingTranslation, CONTACT_WHATSAPP_URL, CONTACT_EMAIL } from '@/lib/i18n/dictionaries/marketing';

// Shared footer for the public marketing site. Only links to pages that
// actually exist (no placeholder legal-page links) — see the plan's note on
// this. Contact channels here match the ones on /contact exactly, so a
// visitor sees the same two real, working channels everywhere.
export function MarketingFooter() {
  const { t } = useMarketingTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800/80 bg-[#050505]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={120} height={18} className="h-5 w-auto object-contain mb-3" unoptimized />
          <p className="text-slate-500 text-sm leading-relaxed">{t('footerTagline')}</p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('footerProductHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/features" className="text-slate-400 hover:text-white transition-colors">{t('navFeatures')}</Link></li>
            <li><Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">{t('navPricing')}</Link></li>
            <li><Link href="/demo" className="text-slate-400 hover:text-white transition-colors">{t('navDemo')}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('footerCompanyHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/faq" className="text-slate-400 hover:text-white transition-colors">{t('navFaq')}</Link></li>
            <li><Link href="/contact" className="text-slate-400 hover:text-white transition-colors">{t('navContact')}</Link></li>
            <li><Link href="/login" className="text-slate-400 hover:text-white transition-colors">{t('footerLoginLink')}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('footerContactHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={CONTACT_WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <MessageCircle className="w-4 h-4 shrink-0" /> {t('footerWhatsappLabel')}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <Mail className="w-4 h-4 shrink-0" /> {t('footerEmailLabel')}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-slate-600 text-xs">{t('footerCopyright')(year)}</p>
        </div>
      </div>
    </footer>
  );
}

export default MarketingFooter;
