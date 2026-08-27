"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Home, ShoppingCart, Bell, CreditCard, Search, Leaf, UtensilsCrossed } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { CategoryTile } from '@/components/CategoryTile';
import { PRODUCTS, CATEGORIES } from '@/data/menuData';
import { getLocalizedCategoryName, getLocalizedText } from '@/lib/translations';
import { cn } from '@/lib/utils';

// Reused by app/[locale]/page.jsx (home QR showcase, via TableHero) and
// app/[locale]/demo/page.jsx — a phone-frame mock around the REAL
// `ProductCard`/`CategoryTile` components rendering REAL seed data
// (data/menuData.js, the same seed CustomerApp itself falls back to), not a
// fabricated screenshot. Both call sites frame it as an illustrative preview,
// not a live menu — handlers are no-ops on purpose.
//
// ---------------------------------------------------------------------------
// WHY THE CONTENT IS BUILT AT 390px AND THEN SCALED
// ---------------------------------------------------------------------------
// This is the fix for the thing that kept looking subtly wrong. The frame is
// only ~232px wide, but CategoryTile and ProductCard are the real components
// at their real sizes — a 56px category icon is 14% of a real 390px phone and
// 24% of this frame. So every shared element rendered ~1.7x oversized next to
// the chrome around it, which had been hand-shrunk to fit. Two scales fighting
// in one picture: category icons, "Şefin Seçimi" badges and card text all read
// as too big.
//
// So the screen is laid out at a REAL phone's logical width (390px, iPhone
// 14/15 class) using CustomerApp's own class names, then scaled down as a
// whole with a transform. Nothing is hand-sized any more, and the result is a
// true miniature: every proportion matches what a diner actually sees.
//
// Two things keep it from drifting again: CategoryTile and ProductCard are
// literally the components the customer menu renders, and the canvas uses
// kit-light's own --k-bg rather than the marketing palette.
//
// --theme-primary stays --mkt-brass: the real menu's accent is per-restaurant
// (0043_customer_theme_colors.sql), so a branded accent is accurate — it shows
// the theming feature rather than misrepresenting a fixed colour.
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = Math.round((PHONE_WIDTH * 19.5) / 9); // 845 — a real 9:19.5 handset

// Rendered before the ResizeObserver has measured anything, and on the server.
// 232px is the frame's width at the default max-w — close enough that the
// first paint is never visibly wrong, and corrected on mount regardless.
const DEFAULT_SCALE = 232 / PHONE_WIDTH;

const SAMPLE_PRODUCT_IDS = ['p1', 'b1', 's1', 'd1'];

// Curated 4-per-category picks for the `showCategories` (demo page) mode —
// real category ids from data/menu.json, so switching tabs browses the same
// seed catalog CustomerApp falls back to.
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

// CustomerApp's BottomNavButton, minus the interactive parts: same gap-1 py-2,
// same h-9 w-[52px] icon pill, same 21px icons and text-[10px] label. Plain
// divs, not buttons — the category tiles above genuinely switch what is shown,
// but nothing here has a target in a static preview, and a clickable-looking
// dead button is worse than an honest static row. Four items = the
// waiter-service model, the default a new restaurant starts on
// (lib/services/serviceModelService.js).
const BOTTOM_NAV_ITEMS = [
  { key: 'menu', Icon: Home, labelKey: 'navMenu', active: true },
  { key: 'cart', Icon: ShoppingCart, labelKey: 'navCart' },
  { key: 'waiter', Icon: Bell, labelKey: 'navWaiter' },
  { key: 'bill', Icon: CreditCard, labelKey: 'navBill' },
];

// `showCategories`: the demo page's richer mode — the category strip becomes
// interactive and swaps which curated products show. The home hero keeps its
// fixed 4-item snapshot, but renders the same chrome, so both pages show one
// consistent picture of the product.
export function PhoneShowcase({ lang = 'az', className = '', showCategories = false }) {
  const [activeCategory, setActiveCategory] = useState(DEMO_CATEGORIES[0]?.id);
  const frameRef = useRef(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  // The frame is `w-full max-w-[...]`, so its real width depends on the layout
  // it lands in (TableHero gives it 78% of a 420px column; /demo gives it a
  // sidebar). Measuring is what keeps the 390px content exactly filling it at
  // any breakpoint instead of overflowing or leaving a gap.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setScale(width / PHONE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const productIds = showCategories ? CATEGORY_PRODUCT_IDS[activeCategory] ?? [] : SAMPLE_PRODUCT_IDS;
  const products = PRODUCTS.filter((p) => productIds.includes(p.id));
  // The home snapshot shows a cross-section of the whole menu, so "Bütün
  // Menyu" is the honest active tile there; the demo tracks the real selection.
  const activeCategoryRow = showCategories ? activeCategory : 'all';
  const headingLabel = showCategories
    ? getLocalizedCategoryName(DEMO_CATEGORIES.find((c) => c.id === activeCategory) || {}, lang)
    : getLocalizedText('allMenu', lang);

  return (
    <div className={`relative mx-auto w-full max-w-[260px] ${className}`}>
      <div className="rounded-[2.5rem] border-4 border-[var(--mkt-line)] bg-[var(--mkt-text)] p-2.5 shadow-2xl shadow-black/15">
        {/* The viewport. Fixed 9:19.5 so it always reads as a handset, and
            overflow-hidden so the 390px screen inside is clipped exactly the
            way a real phone clips a scrollable menu. */}
        <div
          ref={frameRef}
          className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-[var(--k-bg)]"
        >
          <div
            className="absolute left-0 top-0 flex origin-top-left flex-col bg-[var(--k-bg)] kit-light"
            style={{
              width: PHONE_WIDTH,
              height: PHONE_HEIGHT,
              transform: `scale(${scale})`,
              '--theme-primary': 'var(--mkt-brass)',
            }}
          >
            {/* Status strip, on the header's surface colour so the two read as
                one continuous bar the way they do on a real phone. */}
            <div className="flex h-8 shrink-0 items-center justify-center bg-[var(--k-surface)]">
              <div className="h-1.5 w-24 rounded-full bg-slate-300" />
            </div>

            {/* Header — CustomerApp's own: brand initial, restaurant name, and
                the active-table line under it. */}
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--k-border)] bg-[var(--k-surface)] px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--k-r-sm)] bg-[var(--k-accent)] text-[13px] font-semibold text-[var(--k-accent-fg)]">
                M
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-[var(--k-text)]">MenuFlow</p>
                <p className="truncate text-[11px] leading-tight text-[var(--k-text-3)]">
                  {getLocalizedText('activeTable', lang)} · {getLocalizedText('tableFallbackName', lang)(1)}
                </p>
              </div>
            </div>

            <div className="shrink-0 space-y-5 px-4 pt-4">
              {/* Search + veg filter, drawn as static shapes rather than a live
                  Input: this is a picture of the menu, not a second
                  implementation of it. Same h-11 as the real controls. */}
              <div className="flex items-center gap-2.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--k-text-3)]" aria-hidden="true" />
                  <div className="flex h-11 w-full items-center truncate rounded-full border border-[var(--k-border)] bg-[var(--k-surface)] pl-10 pr-9 text-sm text-[var(--k-text-3)]">
                    {getLocalizedText('searchPlaceholder', lang)}
                  </div>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--k-border)] bg-[var(--k-surface)] text-[var(--k-success)]">
                  <Leaf className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
              </div>

              {/* The real CategoryTile, at its real size — see this file's
                  header for why that only works now that the screen is
                  scaled as a whole. */}
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
                <CategoryTile
                  active={activeCategoryRow === 'all'}
                  onClick={noop}
                  icon={<UtensilsCrossed className="h-5 w-5" aria-hidden="true" />}
                  label={getLocalizedText('allMenu', lang)}
                />
                {DEMO_CATEGORIES.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    active={activeCategoryRow === cat.id}
                    onClick={showCategories ? () => setActiveCategory(cat.id) : noop}
                    icon={<span aria-hidden="true" className="text-xl leading-none">{cat.icon}</span>}
                    label={getLocalizedCategoryName(cat, lang)}
                  />
                ))}
              </div>
            </div>

            {/* The clipping lives on THIS wrapper, not on the grid itself. Put
                flex-1/min-h-0 straight on the grid and its rows get squeezed to
                the leftover height — ProductCard is `flex flex-col` with an
                `aspect-square` image, so the image is the flex child that gives
                way and collapses to 0px, leaving a card of bare text. */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="px-4 pt-5">
                <h2 className="mb-3.5 text-[19px] font-bold tracking-[-0.01em] text-[var(--k-text)]">{headingLabel}</h2>
                <div className="grid grid-cols-2 gap-3 pb-4">
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
              </div>
            </div>

            <div className="mt-auto grid shrink-0 grid-cols-4 border-t border-[var(--k-border)] bg-[var(--k-surface)]">
              {BOTTOM_NAV_ITEMS.map(({ key, Icon, labelKey, active }) => (
                <div
                  key={key}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-2',
                    active ? 'text-[var(--k-accent)]' : 'text-[var(--k-text-3)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-[52px] items-center justify-center rounded-full',
                      active ? 'bg-[var(--k-accent-soft)]' : 'bg-transparent',
                    )}
                  >
                    <Icon className="h-[21px] w-[21px]" strokeWidth={2.2} />
                  </span>
                  <span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'font-medium')}>
                    {getLocalizedText(labelKey, lang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneShowcase;
