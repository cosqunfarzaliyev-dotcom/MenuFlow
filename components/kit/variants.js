// ---------------------------------------------------------------------------
// components/kit/variants.js — the Quiet Premium recipe layer.
//
// Every class here reads `var(--k-*)` from components/kit/tokens.css. No raw
// slate-*, no hex literals, no gradients: the whole palette is swappable from
// one CSS file. That is the main structural difference from the older
// the old primitive kit, where ~17 slate literals leaked through the
// token layer itself.
//
// `tone` (not `context`) selects the theme, and it exists only where a recipe
// genuinely differs. Most recipes need no tone at all — because both themes
// declare the SAME token names, one class string renders correctly in both.
// ---------------------------------------------------------------------------
import { cva } from 'class-variance-authority';

// One focus treatment for the entire product. Offset against the panel canvas
// so the ring reads on both dark and light without per-theme overrides.
export const FOCUS = [
  'focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-[var(--k-focus)]',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--k-bg)]',
].join(' ');

const TRANSITION = 'transition-[background-color,border-color,color,opacity] duration-[var(--k-dur)] ease-[var(--k-ease)]';

// ---------------------------------------------------------------------------
// Button — flat fills only. The old kit's gradient + drop-shadow button
// (`.customer-btn-primary`, 0 10px 24px violet glow) is the single most dated
// element in the product and has no equivalent here by design.
// ---------------------------------------------------------------------------
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 shrink-0',
    'font-medium whitespace-nowrap select-none',
    'rounded-[var(--k-r)]',
    TRANSITION,
    'disabled:opacity-45 disabled:pointer-events-none',
    'active:scale-[0.985]',
    FOCUS,
  ].join(' '),
  {
    variants: {
      variant: {
        // Solid accent. `--k-accent-fg` is near-black on the dark theme's
        // orange (8.9:1) and white on the customer theme's brand colour.
        primary: 'bg-[var(--k-accent)] text-[var(--k-accent-fg)] hover:bg-[var(--k-accent-hover)]',
        // Neutral filled — the default for anything that isn't THE action.
        secondary: 'bg-[var(--k-surface-2)] text-[var(--k-text)] border border-[var(--k-border)] hover:bg-[var(--k-surface-3)] hover:border-[var(--k-border-2)]',
        // Hairline only. Reads as a button without competing with primary.
        outline: 'bg-transparent text-[var(--k-text)] border border-[var(--k-border-2)] hover:bg-[var(--k-surface-2)]',
        // No chrome until hovered — toolbars, card actions.
        ghost: 'bg-transparent text-[var(--k-text-2)] hover:bg-[var(--k-surface-2)] hover:text-[var(--k-text)]',
        danger: 'bg-[var(--k-danger-soft)] text-[var(--k-danger)] border border-transparent hover:border-[var(--k-danger)]',
      },
      size: {
        // 28px — dense table-row actions only. Below the 44px touch guidance
        // on purpose; never use for anything a customer taps on mobile.
        xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-[var(--k-r-sm)]',
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-sm',
        // Square icon-only. The old kit had no such size, which is why every
        // icon action in the app is a hand-rolled raw <button> today.
        icon: 'h-9 w-9 p-0 rounded-[var(--k-r-sm)]',
        iconSm: 'h-7 w-7 p-0 rounded-[var(--k-r-sm)]',
        block: 'h-12 w-full px-5 text-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

// ---------------------------------------------------------------------------
// Form controls. Input/Select/Textarea share one recipe so a select can never
// drift a pixel from the input beside it.
// ---------------------------------------------------------------------------
export const fieldControlVariants = cva(
  [
    'w-full bg-[var(--k-surface-2)] text-[var(--k-text)]',
    'border border-[var(--k-border)] rounded-[var(--k-r)]',
    'placeholder:text-[var(--k-text-3)]',
    TRANSITION,
    'hover:border-[var(--k-border-2)]',
    'focus-visible:outline-none focus-visible:border-[var(--k-accent)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--k-accent-soft)]',
    'disabled:opacity-45 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-10 px-3.5 text-sm',
        lg: 'h-12 px-4 text-sm',
        // Textarea: height comes from `rows`, so only padding is set.
        area: 'px-3.5 py-2.5 text-sm resize-none min-h-[80px]',
      },
      invalid: {
        true: 'border-[var(--k-danger)] focus-visible:border-[var(--k-danger)] focus-visible:ring-[var(--k-danger-soft)]',
        false: '',
      },
    },
    defaultVariants: { size: 'md', invalid: false },
  },
);

export const labelVariants = cva('block text-[13px] font-medium text-[var(--k-text-2)] mb-1.5');

// ---------------------------------------------------------------------------
// Tag (the old kit's "Badge"). Tonal, never solid — a solid pill fights the
// content it labels. Each tone is a soft wash + saturated text from tokens.
// ---------------------------------------------------------------------------
export const TAG_TONES = {
  neutral: 'bg-[var(--k-surface-3)] text-[var(--k-text-2)]',
  accent: 'bg-[var(--k-accent-soft)] text-[var(--k-accent)]',
  success: 'bg-[var(--k-success-soft)] text-[var(--k-success)]',
  warning: 'bg-[var(--k-warning-soft)] text-[var(--k-warning)]',
  danger: 'bg-[var(--k-danger-soft)] text-[var(--k-danger)]',
  info: 'bg-[var(--k-info-soft)] text-[var(--k-info)]',
};

export const tagVariants = cva(
  'inline-flex items-center gap-1.5 font-medium whitespace-nowrap',
  {
    variants: {
      tone: TAG_TONES,
      size: {
        sm: 'h-5 px-2 text-[11px] rounded-[var(--k-r-sm)]',
        md: 'h-6 px-2.5 text-xs rounded-[var(--k-r-sm)]',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

// ---------------------------------------------------------------------------
// Card — hairline border + surface fill. No shadow, no blur, no hover-lift.
// Elevation is expressed by tone, not by a drop shadow: `raised` moves UP the
// surface scale instead of casting light. This is the core visual change of
// the redesign and the reason it reads calmer than the glass/shadow system.
// ---------------------------------------------------------------------------
export const cardVariants = cva(
  'rounded-[var(--k-r-lg)] border border-[var(--k-border)]',
  {
    variants: {
      variant: {
        plain: 'bg-[var(--k-surface)]',
        raised: 'bg-[var(--k-surface-2)]',
        // For a card sitting directly on the canvas with nothing behind it.
        outline: 'bg-transparent',
        accent: 'bg-[var(--k-accent-soft)] border-[var(--k-accent-line)]',
        danger: 'bg-[var(--k-danger-soft)] border-[color:var(--k-danger)]/35',
      },
      interactive: {
        true: `cursor-pointer ${TRANSITION} hover:border-[var(--k-border-2)] hover:bg-[var(--k-surface-2)] ${FOCUS}`,
        false: '',
      },
      selected: { true: 'border-[var(--k-accent)]', false: '' },
    },
    defaultVariants: { variant: 'plain', interactive: false, selected: false },
  },
);

// ---------------------------------------------------------------------------
// Banner (the old kit's "Alert").
// ---------------------------------------------------------------------------
export const bannerVariants = cva(
  'flex items-start gap-3 rounded-[var(--k-r)] border px-3.5 py-3 text-[13px] leading-relaxed',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--k-surface-2)] border-[var(--k-border)] text-[var(--k-text-2)]',
        accent: 'bg-[var(--k-accent-soft)] border-[var(--k-accent-line)] text-[var(--k-text)]',
        success: 'bg-[var(--k-success-soft)] border-[color:var(--k-success)]/30 text-[var(--k-text)]',
        warning: 'bg-[var(--k-warning-soft)] border-[color:var(--k-warning)]/30 text-[var(--k-text)]',
        danger: 'bg-[var(--k-danger-soft)] border-[color:var(--k-danger)]/30 text-[var(--k-text)]',
        info: 'bg-[var(--k-info-soft)] border-[color:var(--k-info)]/30 text-[var(--k-text)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

// ---------------------------------------------------------------------------
// Tabs — underline, not a filled pill track. A filled segmented control reads
// as a *control*; an underline reads as *navigation*, which is what every use
// of it in this app actually is.
// ---------------------------------------------------------------------------
export const tabsListVariants = cva('flex items-center gap-1 border-b border-[var(--k-border)] overflow-x-auto');

export const tabsTriggerVariants = cva(
  [
    'relative inline-flex items-center gap-2 shrink-0',
    'h-10 px-3 -mb-px text-[13px] font-medium whitespace-nowrap',
    'border-b-2 rounded-t-[var(--k-r-sm)]',
    TRANSITION,
    FOCUS,
  ].join(' '),
  {
    variants: {
      active: {
        true: 'border-[var(--k-accent)] text-[var(--k-text)]',
        false: 'border-transparent text-[var(--k-text-3)] hover:text-[var(--k-text-2)]',
      },
    },
    defaultVariants: { active: false },
  },
);

// Pill variant, kept for filter rows (customer category bar, user role filter)
// where the items are values rather than destinations.
export const pillVariants = cva(
  [
    'inline-flex items-center gap-2 shrink-0 h-9 px-3.5',
    'text-[13px] font-medium whitespace-nowrap',
    'rounded-[var(--k-r)] border',
    TRANSITION,
    FOCUS,
  ].join(' '),
  {
    variants: {
      active: {
        true: 'bg-[var(--k-accent)] border-[var(--k-accent)] text-[var(--k-accent-fg)]',
        false: 'bg-[var(--k-surface)] border-[var(--k-border)] text-[var(--k-text-2)] hover:border-[var(--k-border-2)] hover:text-[var(--k-text)]',
      },
    },
    defaultVariants: { active: false },
  },
);

// ---------------------------------------------------------------------------
// Sheet (modal + drawer in one primitive, replacing the old Modal).
// ---------------------------------------------------------------------------
export const sheetScrimVariants = cva(
  'fixed inset-0 flex bg-[var(--k-scrim)] backdrop-blur-[2px] motion-reduce:backdrop-blur-none',
  {
    variants: {
      side: {
        center: 'items-center justify-center p-4',
        right: 'justify-end',
        bottom: 'items-end',
      },
      stacked: { true: 'z-[70]', false: 'z-[60]' },
    },
    defaultVariants: { side: 'center', stacked: false },
  },
);

export const sheetPanelVariants = cva(
  [
    'relative w-full bg-[var(--k-surface)] border border-[var(--k-border)]',
    'overflow-y-auto',
    'motion-safe:transition-[opacity,transform] motion-safe:duration-[var(--k-dur-slow)] motion-safe:ease-[var(--k-ease)]',
  ].join(' '),
  {
    variants: {
      side: {
        center: 'rounded-[var(--k-r-lg)] max-h-[88vh]',
        right: 'h-full rounded-none border-y-0 border-r-0 max-h-none',
        bottom: 'rounded-t-[var(--k-r-lg)] border-x-0 border-b-0 max-h-[88vh]',
      },
      size: { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', full: 'max-w-none' },
    },
    defaultVariants: { side: 'center', size: 'md' },
  },
);
