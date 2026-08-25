"use client";

// ---------------------------------------------------------------------------
// components/BannerCarousel.jsx
//
// Presentational-only auto-rotating carousel for the customer menu's banner
// strip (CustomerApp.jsx). Deliberately dumb: CustomerApp resolves each
// banner's clickable action (product/category/external/phone) and builds
// the actual slide content (image or video, title/subtitle overlay) — this
// component only knows how to slide between however many pre-built slides
// it's handed and auto-advance through them. Splitting it out keeps that
// action-resolution logic (which needs PRODUCTS/CATEGORIES/isSafeUrl, all
// local to CustomerApp) separate from the purely mechanical carousel
// behaviour, the same way ProductCard/CartDrawer are their own files.
//
// Previously this was a horizontally-scrollable flex row showing every
// banner side by side (manual swipe only, sized to a fixed 280/360px card).
// Multiple banners now cycle through ONE full-width slot automatically —
// that's what "banners take turns, a few seconds apart" means in practice.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from "react";

const AUTO_ADVANCE_MS = 5000;

export function BannerCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  // Derived at render time rather than clamped via a setState-in-effect: if
  // the active banner list shrinks (an admin deactivates/deletes one) while
  // a later slide is showing, `index` can briefly point past the end of the
  // new, shorter array. Reading it through Math.min here fixes what's ON
  // SCREEN immediately, with no extra render — the raw `index` state itself
  // self-corrects on the very next auto-advance tick anyway, since
  // `(i + 1) % count` always lands back in range regardless of how big the
  // stale `i` was.
  const activeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    if (count <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // Deliberately re-armed on every `index` change too (not just `count`):
    // a dot click or the wrap-around below should reset the countdown to a
    // full AUTO_ADVANCE_MS rather than firing early because most of the
    // previous interval had already elapsed.
  }, [count, index]);

  if (count === 0) return null;

  return (
    <div className="relative h-32 overflow-hidden rounded-[var(--k-r-lg)] border border-[var(--k-border)] sm:h-40">
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.key} className="h-full w-full shrink-0">
            {slide.node}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}/${count}`}
              aria-current={i === activeIndex}
              className={`pointer-events-auto h-1.5 rounded-full transition-all duration-[var(--k-dur)] ${
                i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default BannerCarousel;
