"use client";

import React, { useState } from 'react';
import { Home, ShoppingCart, Bell, CreditCard } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { PRODUCTS, CATEGORIES } from '@/data/menuData';
import { getLocalizedCategoryName, getLocalizedText } from '@/lib/translations';
import { cn } from '@/lib/utils';

// Reused by app/[locale]/page.jsx (home QR showcase) and
// app/[locale]/demo/page.jsx — a phone-frame mock around the REAL
// `ProductCard` component rendering REAL seed data (data/menuData.js, the
// same seed CustomerApp itself falls back to), not a fabricated screenshot.
// Clearly framed by both call sites as an illustrative preview, not a
// live/interactive menu — handlers are no-ops on purpose, this is a
// marketing showcase, not a functional cart.
//
// Still "use client" (not converted to a Server Component along with
// MarketingFooter): ProductCard is itself "use client" and takes
// onOpenDetail/onAddToCart function props — a Server Component parent
// cannot pass plain functions to a Client Component child (they aren't
// serializable across that boundary), so the `noop` functions below must be
// created client-side. `lang` still comes in as a plain prop, not the
// client languageStore — only the component boundary is client, not the
// language source.
//
// ProductCard reads `--k-*` tokens under a `.kit-light`/`.kit-dark` ancestor
// (the same production panel design system CustomerApp itself renders
// through, `components/kit/tokens.css`) — without re-declaring `.kit-light`
// here, every `--k-*` class inside ProductCard resolves to nothing and the
// card renders unstyled. `--theme-primary` feeds `.kit-light`'s `--k-accent`
// (the per-restaurant brand color in the real app); pointed at
// `var(--mkt-brass)` here so the demo's accent matches the marketing site's
// own palette instead of an arbitrary placeholder.
const SAMPLE_PRODUCT_IDS = ['p1', 'b1', 's1', 'd1'];

// Curated 4-per-category picks for the `showCategories` (demo page) mode —
// real category ids from data/menu.json, not a fabricated taxonomy, so
// switching tabs is browsing the same seed catalog CustomerApp itself falls
// back to. Four per category so the 2-column grid below always fills a
// clean 2x2, matching the real menu's own base grid instead of leaving a
// dangling half-empty row. Kept separate from SAMPLE_PRODUCT_IDS so the
// compact home-hero mockup (TableHero) stays a fixed 4-item snapshot, not
// affected by this.
const CATEGORY_PRODUCT_IDS = {
  pizza: ['p1', 'p2', 'p3', 'p4'],
  burger: ['b1', 'b2', 'b3', 'b4'],
  main: ['m1', 'm2', 'm3', 'm4'],
  salads: ['s1', 's2', 's3', 's4'],
  pasta: ['pa1', 'pa2', 'pa3', 'pa4'],
  desserts: ['d1', 'd2', 'd3', 'd4'],
  drinks: ['dr1', 'dr2', 'dr3', 'dr4'],
};
const DEMO_CATEGORIES = CATEGORIES.filter((cat) => CATEGORY_PRODUCT_IDS[cat.id]);

const noop = () => {};

// Mirrors CustomerApp.jsx's real bottom nav bar (icon + label, active tab in
// the accent color) so the mockup's chrome doesn't stop at the product grid
// — the nav is as much "the real menu design" as the cards are. Rendered as
// plain divs, not buttons: unlike the category tabs above (which genuinely
// switch what's shown), nothing here has a real target in a static preview
// — a clickable-looking dead button would be worse than an honest static row.
const BOTTOM_NAV_ITEMS = [
  { key: 'menu', Icon: Home, labelKey: 'navMenu', active: true },
  { key: 'cart', Icon: ShoppingCart, labelKey: 'navCart' },
  { key: 'waiter', Icon: Bell, labelKey: 'navWaiter' },
  { key: 'bill', Icon: CreditCard, labelKey: 'navBill' },
];

// `showCategories`: the demo page's richer mode — a real category tab bar
// (still static/illustrative, tabs just swap which curated products show;
// no add-to-cart/detail-modal wiring, that's still out of scope for a
// marketing snapshot) so /demo actually resembles a full, browsable menu
// instead of a fixed 3-item strip. The compact default (home hero) is
// unchanged for callers that don't pass it.
export function PhoneShowcase({ lang = 'az', className = '', showCategories = false }) {
  const [activeCategory, setActiveCategory] = useState(DEMO_CATEGORIES[0]?.id);
  const productIds = showCategories ? CATEGORY_PRODUCT_IDS[activeCategory] ?? [] : SAMPLE_PRODUCT_IDS;
  const products = PRODUCTS.filter((p) => productIds.includes(p.id));

  return (
    <div className={`relative mx-auto w-full max-w-[300px] ${className}`}>
      <div className="rounded-[2.5rem] border-4 border-[var(--mkt-line)] bg-[var(--mkt-text)] p-2.5 shadow-2xl shadow-black/15">
        <div className="rounded-[2rem] overflow-hidden bg-[var(--mkt-ground)] kit-light" style={{ '--theme-primary': 'var(--mkt-brass)' }}>
          {/* Screen background is --mkt-ground (site cream), not kit-light's
              own --k-bg — the phone should read as "the same room as the
              marketing site," not a slightly different off-white next to
              it. Cards (--k-surface, white) and the bottom nav still use
              kit-light's real tokens on top of this, unchanged — only the
              base canvas layer is retinted. */}
          <div className="h-6 flex items-center justify-center bg-[var(--mkt-ground)]">
            {/* Sits on the phone's cream screen, not the dark bezel — a
                light neutral, not --mkt-line (that's tuned for the page
                background and would be nearly invisible here). */}
            <div className="w-16 h-1.5 rounded-full bg-slate-300" />
          </div>
          {showCategories && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pt-1 pb-2">
              {DEMO_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors',
                    activeCategory === cat.id
                      ? 'bg-[var(--k-accent)] text-[var(--k-accent-fg)]'
                      : 'bg-[var(--k-surface-2)] text-[var(--k-text-2)]',
                  )}
                >
                  <span aria-hidden="true" className="mr-1">{cat.icon}</span>
                  {getLocalizedCategoryName(cat, lang)}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-[520px] overflow-hidden px-3 pb-4 grid grid-cols-2 gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={noop}
                onAddToCart={noop}
                lang={lang}
              />
            ))}
          </div>
          <div className="grid grid-cols-4 border-t border-[var(--k-border)] bg-[var(--k-surface)]">
            {BOTTOM_NAV_ITEMS.map(({ key, Icon, labelKey, active }) => (
              <div key={key} className={cn('flex flex-col items-center justify-center gap-1 py-2', active ? 'text-[var(--k-accent)]' : 'text-[var(--k-text-3)]')}>
                <span className={cn('flex h-7 w-11 items-center justify-center rounded-full', active ? 'bg-[var(--k-accent-soft)]' : 'bg-transparent')}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className={cn('text-[9px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                  {getLocalizedText(labelKey, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneShowcase;
