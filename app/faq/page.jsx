"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { useMarketingTranslation } from '@/lib/i18n/dictionaries/marketing';

const FAQ_KEYS = Array.from({ length: 10 }, (_, i) => i + 1); // faqQ1..faqQ10 / faqA1..faqA10

// Small local accordion — no new dependency, same reasoning as the rest of
// this codebase (e.g. PromotionsTab's own local form state): one open index
// at a time is all this needs, doesn't warrant Radix or a shared primitive.
function FaqItem({ question, answer, open, onToggle }) {
  return (
    <div className="border border-slate-800 rounded-2xl bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-white font-bold text-sm sm:text-base">{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-slate-400 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const { t } = useMarketingTranslation();
  const [openIndex, setOpenIndex] = useState(1);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketingHeader />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-10 text-center">
        <Badge tone="warning" className="mb-4">{t('faqPageEyebrow')}</Badge>
        <h1 className="font-serif-title font-bold text-4xl sm:text-5xl text-white mb-4">{t('faqPageTitle')}</h1>
        <p className="text-slate-400 text-base sm:text-lg">
          {t('faqPageSubtitle')}{' '}
          <Link href="/contact" className="text-blue-400 hover:text-blue-300 font-bold">{t('faqPageContactLink')}</Link>
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 space-y-3">
        {FAQ_KEYS.map((n) => (
          <FaqItem
            key={n}
            question={t(`faqQ${n}`)}
            answer={t(`faqA${n}`)}
            open={openIndex === n}
            onToggle={() => setOpenIndex((cur) => (cur === n ? null : n))}
          />
        ))}
      </section>

      <section className="border-t border-slate-800/80 bg-slate-950/40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
          <p className="text-slate-400 mb-4">{t('faqPageSubtitle')}</p>
          <Link href="/contact" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold text-sm transition-colors">
            {t('faqPageContactLink')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
