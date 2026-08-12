"use client";

import React from 'react';
import { ProductCard } from '@/components/ProductCard';
import { PRODUCTS } from '@/data/menuData';
import { useLanguage } from '@/hooks/useLanguage';

// Reused by app/page.jsx (home QR showcase) and app/demo/page.jsx — a
// phone-frame mock around the REAL `ProductCard` component rendering REAL
// seed data (data/menuData.js, the same seed CustomerApp itself falls back
// to), not a fabricated screenshot. Clearly framed by both call sites as an
// illustrative preview, not a live/interactive menu — handlers are no-ops
// on purpose, this is a marketing showcase, not a functional cart.
//
// ProductCard reads `--theme-primary`/`.customer-theme` (see CustomerApp.jsx
// for the same pattern) — without re-declaring both here, every themed class
// inside ProductCard would resolve to nothing on this dark marketing page.
const SAMPLE_PRODUCT_IDS = ['p1', 's1', 'd1'];

const noop = () => {};

export function PhoneShowcase({ className = '' }) {
  const { language } = useLanguage();
  const products = PRODUCTS.filter((p) => SAMPLE_PRODUCT_IDS.includes(p.id));

  return (
    <div className={`relative mx-auto w-full max-w-[300px] ${className}`}>
      <div className="rounded-[2.5rem] border-4 border-slate-800 bg-slate-950 p-2.5 shadow-2xl shadow-black/50">
        <div className="rounded-[2rem] overflow-hidden bg-[#F7F8FA] customer-theme" style={{ '--theme-primary': '#6C4CFF' }}>
          <div className="h-6 flex items-center justify-center bg-[#F7F8FA]">
            <div className="w-16 h-1.5 rounded-full bg-slate-300" />
          </div>
          <div className="max-h-[520px] overflow-hidden px-3 pb-4 space-y-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={noop}
                onAddToCart={noop}
                isFavorite={false}
                onToggleFavorite={noop}
                lang={language}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneShowcase;
