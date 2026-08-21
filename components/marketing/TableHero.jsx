"use client";

// The signature element promised for the "Süfrə" (table) design brief and
// never actually built in the first mkt pass (that pass only reskinned the
// old text-left/phone-right SaaS-template hero onto new colors — see the
// commit that added this file for why that wasn't good enough).
//
// A flat-lay composition instead of a floating phone mockup: the real
// PhoneShowcase (an actual ProductCard, not an illustration) sits center as
// the "menu", a small QR table-stand card and an order-ticket strip overlap
// its corners at different rotations — three objects laid on a table, not
// three cards in a grid. On scroll, the three layers drift at slightly
// different rates (useScroll/useTransform, motion/react — already a repo
// dependency, see components/kit/Sidebar.jsx for the same import) so the
// composition has real depth instead of being a static screenshot.
// `prefers-reduced-motion` collapses all three ranges to 0, per
// CLAUDE.md-adjacent conventions elsewhere in this codebase.
import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { QrCode, Check } from 'lucide-react';
import { PhoneShowcase } from './PhoneShowcase';

export function TableHero({ lang, tableLabel, ticketLines }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const phoneY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -40]);
  const qrY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -90]);
  const ticketY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -20]);

  return (
    // overflow-hidden: the QR table-stand and order-ticket cards below are
    // deliberately positioned to bleed slightly past this container's own
    // edge (negative left/right + a rotation, for the "laid on a table"
    // effect) — on mobile, where this component has no surrounding page
    // padding of its own, that bleed reaches the true viewport edge and
    // reads as a gap on the right (see globals.css's `html { overflow-x:
    // hidden }` comment for the mobile-Safari-specific half of this fix).
    // Safe against the vertical parallax below: the full upward
    // `qrY`/`ticketY` translation only completes once this section is
    // scrolling out of view at the TOP anyway, so there's nothing left to
    // visibly clip by the time it would matter.
    <div ref={ref} className="relative mx-auto max-w-[420px] overflow-hidden pt-6 pb-16 sm:pb-24">
      {/* The "table" itself — a soft radial pool of shadow under the
          composition, standing in for the surface everything sits on. */}
      <div
        className="absolute left-1/2 top-[62%] -z-10 h-40 w-[85%] -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(closest-side, rgba(42,33,21,0.12), transparent)' }}
        aria-hidden="true"
      />

      <motion.div style={{ y: phoneY }} className="mx-auto w-[78%] -rotate-3">
        <PhoneShowcase lang={lang} />
      </motion.div>

      {/* QR table-stand — a die-cut card, not a rounded square icon tile:
          the fold line + base give it the silhouette of an actual printed
          table-tent QR stand rather than a generic app icon. */}
      <motion.div
        style={{ y: qrY }}
        className="absolute -left-2 bottom-16 w-[130px] rotate-[9deg] sm:-left-6 sm:bottom-20"
      >
        <div className="rounded-lg bg-[var(--mkt-linen)] p-3 pb-4 shadow-[0_18px_30px_-12px_rgba(42,33,21,0.18)]">
          <div className="flex h-8 items-center justify-center rounded-sm bg-[var(--mkt-text)]">
            <QrCode className="h-5 w-5 text-[var(--mkt-linen)]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--mkt-text)]">
            {tableLabel}
          </p>
        </div>
        {/* fold crease at the card's base, tilted with the card */}
        <div className="mx-auto h-2 w-[70%] rounded-b-sm bg-[var(--mkt-linen)]/70" />
      </motion.div>

      {/* Order ticket — a torn-edge strip of skeleton lines + a confirmed
          checkmark, standing in for a kitchen order slip. */}
      <motion.div
        style={{ y: ticketY }}
        className="absolute -right-3 top-10 w-[128px] -rotate-[7deg] sm:-right-8 sm:top-16"
      >
        <div className="rounded-sm bg-[var(--mkt-linen)] px-3 py-3 shadow-[0_14px_26px_-10px_rgba(42,33,21,0.16)]">
          <div className="flex items-center gap-1.5 border-b border-dashed border-[var(--mkt-text)]/25 pb-1.5">
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--mkt-sage)]">
              <Check className="h-2 w-2 text-[var(--mkt-linen)]" strokeWidth={3} />
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--mkt-text)]">{ticketLines.status}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {ticketLines.items.map((item, i) => (
              <div key={i} className="h-1.5 rounded-full bg-[var(--mkt-text)]/15" style={{ width: `${item}%` }} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TableHero;
