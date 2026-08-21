"use client";

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Small local accordion — no new dependency, same reasoning as the rest of
// this codebase (e.g. PromotionsTab's own local form state): one open item
// at a time is all this needs, doesn't warrant Radix or a shared primitive.
//
// Pure UI-state leaf: `items` (already {id, question, answer} in the
// request's locale) is prepared and translated by the Server Component page
// that renders this — this component itself never touches i18n or the
// client languageStore, only React state.
function FaqItem({ question, answer, open, onToggle }) {
  return (
    <div className="border border-[var(--mkt-line)] rounded-2xl bg-[var(--mkt-surface-2)]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-[var(--mkt-text)] font-bold text-sm sm:text-base">{question}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--mkt-text-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-[var(--mkt-text-2)] text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export function FaqAccordionList({ items, defaultOpenId = null }) {
  const [openId, setOpenId] = useState(defaultOpenId);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FaqItem
          key={item.id}
          question={item.question}
          answer={item.answer}
          open={openId === item.id}
          onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
        />
      ))}
    </div>
  );
}

export default FaqAccordionList;
