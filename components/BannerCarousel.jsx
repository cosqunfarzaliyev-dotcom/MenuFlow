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
// Multiple banners cycle through ONE full-width slot automatically, and the
// customer can also drive it by hand: swipe (the natural gesture on the
// phone this menu is actually read on), the arrow buttons, or the dots.
//
// AUTO-ADVANCE STOPS PERMANENTLY ON FIRST MANUAL INPUT. Resuming the timer
// after a pause would yank the customer off whatever they deliberately
// navigated to, which is the single most irritating thing a carousel can
// do — once someone takes control, the rotation is theirs, not ours.
// ---------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AUTO_ADVANCE_MS = 5000;
// Below this the gesture reads as a tap (or a vertical page scroll that
// happened to wobble sideways), not a deliberate swipe.
const SWIPE_THRESHOLD_PX = 40;

export function BannerCarousel({ slides, prevLabel, nextLabel, goToLabel }) {
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const count = slides.length;
  // Derived at render time rather than clamped via a setState-in-effect: if
  // the active banner list shrinks (an admin deactivates/deletes one) while
  // a later slide is showing, `index` can briefly point past the end of the
  // new, shorter array. Reading it through Math.min here fixes what's ON
  // SCREEN immediately, with no extra render — the raw `index` state itself
  // self-corrects on the very next advance anyway, since `(i + 1) % count`
  // always lands back in range regardless of how big the stale `i` was.
  const activeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  useEffect(() => {
    if (count <= 1 || manual) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [count, index, manual]);

  // Every manual entry point goes through this, so "stop auto-advancing"
  // can never be forgotten at one call site while working at another.
  const goTo = (next) => {
    setManual(true);
    setIndex(((next % count) + count) % count);
  };

  const handleTouchStart = (e) => {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Horizontal intent only: the banner strip sits in a vertically
    // scrolling page, so a mostly-vertical drag must stay a page scroll and
    // never steal the gesture to change slides.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    goTo(activeIndex + (dx < 0 ? 1 : -1));
  };

  if (count === 0) return null;

  const arrowClass = 'pointer-events-auto absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

  return (
    <div
      className="relative h-32 overflow-hidden rounded-[var(--k-r-lg)] border border-[var(--k-border)] sm:h-40"
      onTouchStart={count > 1 ? handleTouchStart : undefined}
      onTouchEnd={count > 1 ? handleTouchEnd : undefined}
    >
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
        <>
          {/* Real <button>s rather than swipe-only, so the carousel is
              reachable by keyboard and on desktop, where there is no swipe
              gesture at all. */}
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label={prevLabel}
            className={`${arrowClass} left-2`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label={nextLabel}
            className={`${arrowClass} right-2`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => goTo(i)}
                aria-label={goToLabel ? goToLabel(i + 1, count) : `${i + 1}/${count}`}
                aria-current={i === activeIndex}
                className={`pointer-events-auto h-1.5 rounded-full transition-all duration-[var(--k-dur)] ${
                  i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BannerCarousel;
