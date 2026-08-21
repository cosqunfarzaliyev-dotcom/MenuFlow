// Replaces the icon-in-rounded-square card grid (the single most generic
// SaaS-template shape — every AI-generated features section looks like
// this) with the one structural device that's actually native to this
// brief: a restaurant menu listing. Numbered like a real printed menu
// (01, 02, ...), name + dot-leader + a one-line descriptor where a menu
// would put its price. No icons, no cards, no grid — a list, because a
// menu is a list. Server Component: purely presentational, no state.
export function MenuList({ items }) {
  return (
    <ol className="divide-y divide-[var(--mkt-line)] border-y border-[var(--mkt-line)]">
      {items.map(({ number, title, description }, i) => (
        <li key={i} className="flex flex-col gap-1.5 py-5 sm:flex-row sm:items-baseline sm:gap-4 sm:py-6">
          <div className="flex items-baseline gap-3 sm:contents">
            <span className="k-nums shrink-0 text-lg text-[var(--mkt-brass)] sm:text-xl" style={{ fontFamily: 'var(--mkt-font-display)' }}>
              {number}
            </span>
            <span className="min-w-0 shrink-0 text-lg text-[var(--mkt-text)] sm:text-xl" style={{ fontFamily: 'var(--mkt-font-display)' }}>
              {title}
            </span>
          </div>
          {/* The dot-leader — the exact typographic device printed menus use
              between an item name and its price. Here it leads to a
              benefit sentence instead of a price. Row layout only from sm
              up; on mobile the description drops below instead of forcing
              a full sentence onto the numbered title line. */}
          <span className="hidden min-w-[24px] flex-1 self-end border-b border-dotted border-[var(--mkt-text-3)]/40 sm:block" aria-hidden="true" />
          <span className="pl-8 text-sm leading-relaxed text-[var(--mkt-text-2)] sm:max-w-xs sm:pl-0 sm:text-right">
            {description}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default MenuList;
