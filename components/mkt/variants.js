// ---------------------------------------------------------------------------
// components/mkt/variants.js — cva recipes for the "Süfrə" marketing design
// system. Mirrors components/kit/variants.js's shape (same cva pattern, same
// file layout) so the two systems read as siblings, not unrelated code.
// Every color reference is a --mkt-* token (components/mkt/tokens.css) —
// never a raw hex or a Tailwind palette color, so a future palette tweak is
// one file, not a grep-and-replace across every marketing page.
// ---------------------------------------------------------------------------
import { cva } from 'class-variance-authority';

export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mkt-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mkt-ground)]';
const TRANSITION = 'transition-colors duration-[var(--mkt-dur)] ease-[var(--mkt-ease)]';

export const buttonVariants = cva(
  ['inline-flex items-center justify-center font-semibold whitespace-nowrap', TRANSITION, FOCUS, 'disabled:opacity-45 disabled:pointer-events-none'].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-[var(--mkt-brass)] text-[var(--mkt-brass-fg)] hover:bg-[var(--mkt-brass-hover)]',
        secondary: 'bg-[var(--mkt-surface-2)] text-[var(--mkt-text)] border border-[var(--mkt-line)] hover:border-[var(--mkt-brass-line)] hover:bg-[var(--mkt-surface-3)]',
        ghost: 'text-[var(--mkt-text-2)] hover:text-[var(--mkt-text)] hover:bg-[var(--mkt-surface-2)]',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px] rounded-[var(--mkt-r-sm)] gap-1.5',
        md: 'h-11 px-5 text-sm rounded-[var(--mkt-r)] gap-2',
        lg: 'h-12 px-6 text-[15px] rounded-[var(--mkt-r)] gap-2',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export const cardVariants = cva(
  'rounded-[var(--mkt-r-lg)] border border-[var(--mkt-line)] bg-[var(--mkt-surface)]',
  {
    variants: {
      variant: {
        plain: '',
        elevated: 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
        flat: 'border-transparent bg-[var(--mkt-surface-2)]',
      },
    },
    defaultVariants: { variant: 'plain' },
  },
);

// tone -> {bg, text, border} — every tone derived from the palette's own
// three colors (brass/sage/danger) plus neutral, no imported hue.
export const BADGE_TONE_CLASSES = {
  neutral: 'bg-[var(--mkt-surface-2)] text-[var(--mkt-text-2)] border-[var(--mkt-line)]',
  brand: 'bg-[var(--mkt-brass-soft)] text-[var(--mkt-brass)] border-[var(--mkt-brass-line)]',
  success: 'bg-[var(--mkt-sage-soft)] text-[var(--mkt-sage)] border-transparent',
  info: 'bg-[var(--mkt-surface-2)] text-[var(--mkt-text-2)] border-[var(--mkt-line)]',
  warning: 'bg-[var(--mkt-brass-soft)] text-[var(--mkt-brass)] border-[var(--mkt-brass-line)]',
  danger: 'bg-[var(--mkt-danger-soft)] text-[var(--mkt-danger)] border-transparent',
};

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
  {
    variants: { tone: BADGE_TONE_CLASSES },
    defaultVariants: { tone: 'neutral' },
  },
);

export const tabsListVariants = 'flex items-center gap-1 border-b border-[var(--mkt-line)]';
export const tabsTriggerVariants = cva(
  ['relative -mb-px px-3.5 py-2.5 text-sm font-medium border-b-2', TRANSITION, FOCUS].join(' '),
  {
    variants: {
      active: {
        true: 'border-[var(--mkt-brass)] text-[var(--mkt-text)]',
        false: 'border-transparent text-[var(--mkt-text-3)] hover:text-[var(--mkt-text-2)]',
      },
    },
    defaultVariants: { active: false },
  },
);
