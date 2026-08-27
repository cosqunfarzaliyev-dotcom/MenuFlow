"use client";

import React, { useState } from 'react';
import { Home, ShoppingCart, Bell, CreditCard, Search, Leaf, UtensilsCrossed } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { CategoryTile } from '@/components/CategoryTile';
import { PRODUCTS, CATEGORIES } from '@/data/menuData';
import { getLocalizedCategoryName, getLocalizedText } from '@/lib/translations';
import { cn } from '@/lib/utils';

// Reused by app/[locale]/page.jsx (home QR showcase) and
// app/[locale]/demo/page.jsx — a phone-frame mock around the REAL
// `ProductCard`/`CategoryTile` components rendering REAL seed data
// (data/menuData.js, the same seed CustomerApp itself falls back to), not a
// fabricated screenshot. Both call sites frame it as an illustrative preview,
// not a live menu — handlers are no-ops on purpose.
//
// ---------------------------------------------------------------------------
// WHY THIS MIRRORS CustomerApp.jsx STRUCTURALLY
// ---------------------------------------------------------------------------
// This mockup is what a prospective restaurant owner believes they are buying.
// An earlier version drew its own pill-shaped category tabs on a cream canvas
// with no header and no search bar — close enough to look deliberate,
// different enough that the demo and the real menu read as two separate
// products. The order below is CustomerApp's own: header -> search ->
// categories -> section heading -> product grid -> bottom nav.
//
// Two things keep it from drifting again: CategoryTile and ProductCard are
// literally the components the customer menu renders, and the canvas uses
// kit-light's own --k-bg rather than the marketing palette. (An earlier build
// deliberately retinted the screen to --mkt-ground so the phone read as "the
// same room as the site" — that traded fidelity for cohesion, and fidelity is
// the entire job of this mockup.)
//
// --theme-primary stays --mkt-brass: the real menu's accent is per-restaurant
// (0043_customer_theme_colors.sql), so a branded accent is accurate — it shows
// the theming feature rather than misrepresenting a fixed colour.
//
// Still "use client": ProductCard takes function props, which a Server
// Component parent cannot pass across that boundary. `lang` is a plain prop,
// not the client languageStore.
const SAMPLE_PRODUCT_IDS = ['p1', 'b1', 's1', 'd1'];

// Curated 4-per-category picks for the `showCategories` (demo page) mode —
// real category ids from data/menu.json, so switching tabs browses the same
// seed catalog CustomerApp falls back to. Four per category fills the
// 2-column grid cleanly, matching the real menu's own base grid.
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

// Mirrors CustomerApp's bottom nav. Plain divs, not buttons: the category
// tiles above genuinely switch what is shown, but nothing here has a target in
// a static preview, and a clickable-looking dead button is worse than an
// honest static row. Four items = the waiter-service model, the default a new
// restaurant starts on (lib/services/serviceModelService.js).
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
        {/* Fixed 9:19.5 — a real handset's proportions (iPhone 14/15 class).
            The screen is a viewport, not a container that grows: once the
            header, search bar and category strip were added the frame stretched
            to roughly 1:2.5 and stopped reading as a phone at all. Everything
            below is shrink-0 except the product grid, which takes the remainder
            and clips — which is exactly what a real phone does with a
            scrollable menu, so the cut-off row is honest rather than a bug. */}
        <div
          className="rounded-[2rem] overflow-hidden bg-[var(--k-bg)] kit-light flex flex-col aspect-[9/19.5]"
          style={{ '--theme-primary': 'var(--mkt-brass)' }}
        >
          {/* Notch strip sits on the header's surface colour, so the header
              reads as one continuous bar the way it does on a real phone. */}
          <div className="h-6 shrink-0 flex items-center justify-center bg-[var(--k-surface)]">
            <div className="w-16 h-1.5 rounded-full bg-slate-300" />
          </div>

          {/* Header — CustomerApp's own: brand initial, restaurant name, and
              the active-table line under it. Its absence was the single
              biggest tell that this was not the real menu. */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--k-border)] bg-[var(--k-surface)] px-3 py-2.5">
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

          <div className="shrink-0 px-3 pt-3 space-y-3">
            {/* Search + veg filter, drawn as static shapes rather than a live
                Input: this is a picture of the menu, not a second
                implementation of it. */}
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--k-text-3)]" aria-hidden="true" />
                <div className="h-9 w-full rounded-full border border-[var(--k-border)] bg-[var(--k-surface)] pl-8 pr-3 flex items-center truncate text-[11px] text-[var(--k-text-3)]">
                  {getLocalizedText('searchPlaceholder', lang)}
                </div>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--k-border)] bg-[var(--k-surface)] text-[var(--k-success)]">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            {/* The real CategoryTile, not a look-alike — see this file's header. */}
            <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 no-scrollbar">
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

            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--k-text)]">{headingLabel}</h2>
          </div>

          {/* The clipping lives on THIS wrapper, not on the grid itself. Put
              flex-1/min-h-0 straight on the grid and its rows get squeezed to
              the leftover height — ProductCard is `flex flex-col` with an
              `aspect-square` image, so the image is the flex child that gives
              way and collapses to 0px, leaving a card of bare text. The grid
              below keeps its natural height and simply gets cut off by the
              overflow here, which is what a real phone viewport does. */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="grid grid-cols-2 gap-3 px-3 pb-4 pt-3">
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

          <div className="mt-auto grid shrink-0 grid-cols-4 border-t border-[var(--k-border)] bg-[var(--k-surface)]">
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
