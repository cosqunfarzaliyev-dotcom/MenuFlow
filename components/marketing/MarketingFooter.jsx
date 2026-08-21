import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageCircle, Mail } from 'lucide-react';
import { getMarketingDictionary } from '@/lib/i18n/server';

// Shared footer for the public marketing site. No hooks, no interactivity,
// no data-fetching of its own — a plain Server Component, resolved once per
// request from `locale` (a route-param string, not the client
// languageStore). `whatsappUrl`/`email` come from app/[locale]/layout.jsx,
// which reads them from site_content (supabase/migrations/
// 0032_site_content_cms.sql, keys contact.whatsapp_url/contact.email) —
// the SAME values app/[locale]/contact/page.jsx renders, so a SuperAdmin
// edit to either changes both places at once. Only links to pages that
// actually exist (no placeholder legal-page links).
export function MarketingFooter({ locale, whatsappUrl, email }) {
  const { t } = getMarketingDictionary(locale);
  const year = new Date().getFullYear();
  const href = (slug) => (slug ? `/${locale}/${slug}` : `/${locale}`);

  return (
    <footer className="border-t border-[var(--mkt-line)] bg-[var(--mkt-ground)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <Image src="/brand/menuflow-logo-mkt-h48.png" alt="MenuFlow" width={120} height={18} className="h-5 w-auto object-contain mb-3" unoptimized />
          <p className="text-[var(--mkt-text-3)] text-sm leading-relaxed">{t('footerTagline')}</p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-3">{t('footerProductHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={href('features')} className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('navFeatures')}</Link></li>
            <li><Link href={href('pricing')} className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('navPricing')}</Link></li>
            <li><Link href={href('demo')} className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('navDemo')}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-3">{t('footerCompanyHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={href('faq')} className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('navFaq')}</Link></li>
            <li><Link href={href('contact')} className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('navContact')}</Link></li>
            <li><Link href="/login" className="text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">{t('footerLoginLink')}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--mkt-text-3)] mb-3">{t('footerContactHeading')}</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">
                <MessageCircle className="w-4 h-4 shrink-0" /> {t('footerWhatsappLabel')}
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`} className="flex items-center gap-2 text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] transition-colors">
                <Mail className="w-4 h-4 shrink-0" /> {t('footerEmailLabel')}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--mkt-line)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-[var(--mkt-text-3)] text-xs">{t('footerCopyright')(year)}</p>
        </div>
      </div>
    </footer>
  );
}

export default MarketingFooter;
