// ---------------------------------------------------------------------------
// components/ui/variants.js — the design-token layer for the primitive kit.
//
// No JSX lives here on purpose: the cva recipes ARE the visual vocabulary,
// and keeping them in one file means the whole system fits on one screen.
// Components (Button.jsx etc.) are thin wrappers around these.
//
// Every recipe reads from the `--mf-*` CSS variables (app/globals.css:
// `.customer-theme` for the light per-restaurant context, `.mf-dark` for the
// Admin/Staff/SuperAdmin management context) rather than hardcoding hex or
// slate-* values, so both contexts stay driven by one variable namespace.
// `context` selects which literal set of Tailwind classes a call site gets;
// nothing here talks to React state, so it stays trivially usable outside a
// component too — e.g. `cn(buttonVariants({ variant: 'ghost' }), extra)` on
// a <Link> that must look like a button.
// ---------------------------------------------------------------------------
import { cva } from 'class-variance-authority';

// Shared focus-visible treatment. Every interactive primitive gets a real
// keyboard focus ring — the codebase currently has 50 `focus:outline-none`
// sites and zero `focus-visible:`, which is what this kit is fixing.
// Exported (not just module-local) so Navigation's breadcrumb links can
// reuse the exact same ring instead of re-deriving it.
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-bold transition-colors',
    'disabled:opacity-60 disabled:pointer-events-none',
    FOCUS_RING,
  ].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      variant: { primary: '', secondary: '', destructive: '', ghost: '', subtle: '' },
      size: {
        // Touch-target guidance: 44x44px minimum. sm is for dense table-row
        // actions only (documented, not enforced) — md/lg/block clear 44px.
        sm: 'px-3 py-2 text-xs rounded-xl',
        md: 'px-5 py-2.5 text-sm rounded-xl min-h-[40px]',
        lg: 'px-5 py-3 text-sm rounded-2xl min-h-[44px]',
        block: 'w-full py-3.5 text-sm rounded-xl min-h-[48px]',
      },
    },
    compoundVariants: [
      // Dark (Admin/Staff/SuperAdmin) — lifted verbatim from the existing
      // literal class strings so adopting the primitive is a pure deletion,
      // not a restyle. Colors reference --mf-* so a future palette change is
      // a CSS edit, not a find-and-replace across components.
      { context: 'dark', variant: 'primary', class: 'bg-[var(--mf-primary)] hover:bg-[var(--mf-primary-strong)] text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', variant: 'secondary', class: 'bg-slate-800 hover:bg-slate-700 text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', variant: 'destructive', class: 'bg-rose-600 hover:bg-rose-500 text-white focus-visible:ring-rose-400 focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', variant: 'subtle', class: 'bg-[var(--mf-surface)] border border-[var(--mf-border)] hover:border-slate-700 text-[var(--mf-text-muted)] hover:text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', variant: 'ghost', class: 'bg-transparent text-[var(--mf-text-muted)] hover:text-white hover:bg-slate-800/70 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },

      // Customer — delegates to the existing hand-written `.customer-btn-*`
      // classes rather than re-specifying the gradient/press behavior, so
      // the two cannot drift apart. Ring color follows the per-restaurant
      // --theme-primary variable CustomerApp already sets inline.
      { context: 'customer', variant: 'primary', class: 'customer-btn-primary focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'customer', variant: 'secondary', class: 'bg-white border border-[var(--mf-border)] text-[var(--mf-text)] hover:border-[var(--theme-primary)]/40 rounded-2xl focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'customer', variant: 'ghost', class: 'bg-transparent text-[var(--mf-text-muted)] hover:text-[var(--mf-text)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'customer', variant: 'destructive', class: 'bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:ring-rose-400 focus-visible:ring-offset-white' },
    ],
    defaultVariants: { context: 'dark', variant: 'primary', size: 'md' },
  },
);

export const inputVariants = cva(
  ['w-full transition-colors', FOCUS_RING, 'disabled:opacity-60 disabled:cursor-not-allowed'].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      size: {
        sm: 'px-3 py-2 text-xs rounded-lg',
        md: 'px-4 py-2.5 text-sm rounded-xl',
      },
      invalid: { true: '', false: '' },
      // Success-state counterpart to `invalid`, added to complete the
      // primitive kit's form-states coverage (default/focus/disabled/error
      // already existed; success didn't). A separate boolean rather than
      // widening `invalid` into a tri-state, so the existing `invalid:
      // true/false` contract any future caller relies on can't silently
      // change shape. Defaults false, so any call site that never passes it
      // resolves through the exact same `invalid` compound as before this
      // was added — zero visual change for existing usage.
      valid: { true: '', false: '' },
    },
    compoundVariants: [
      { context: 'dark', invalid: false, valid: false, class: 'bg-[var(--mf-surface)] border border-[var(--mf-border)] text-white placeholder:text-slate-600 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)] focus-visible:border-[var(--mf-primary)]' },
      { context: 'dark', invalid: true, class: 'bg-[var(--mf-surface)] border border-rose-600/60 text-white placeholder:text-slate-600 focus-visible:ring-rose-400 focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', invalid: false, valid: true, class: 'bg-[var(--mf-surface)] border border-emerald-600/60 text-white placeholder:text-slate-600 focus-visible:ring-emerald-400 focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'customer', invalid: false, valid: false, class: 'bg-[var(--mf-bg-secondary)] border border-[var(--mf-border)] text-[var(--mf-text)] placeholder:text-[var(--mf-text-muted)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white focus-visible:border-[var(--theme-primary)]' },
      { context: 'customer', invalid: true, class: 'bg-[var(--mf-bg-secondary)] border border-rose-400 text-[var(--mf-text)] placeholder:text-[var(--mf-text-muted)] focus-visible:ring-rose-400 focus-visible:ring-offset-white' },
      { context: 'customer', invalid: false, valid: true, class: 'bg-[var(--mf-bg-secondary)] border border-emerald-400 text-[var(--mf-text)] placeholder:text-[var(--mf-text-muted)] focus-visible:ring-emerald-400 focus-visible:ring-offset-white' },
    ],
    defaultVariants: { context: 'dark', size: 'md', invalid: false, valid: false },
  },
);

// Select shares the input recipe's surface treatment exactly — a <select>
// styled to match its neighboring <input> is the whole point.
export const selectVariants = inputVariants;

export const labelVariants = cva('block font-bold mb-1', {
  variants: {
    context: {
      dark: 'text-slate-400',
      customer: 'text-[var(--mf-text-muted)]',
    },
    size: {
      sm: 'text-xs',
      md: 'text-sm',
    },
  },
  defaultVariants: { context: 'dark', size: 'sm' },
});

// `tone` is semantic (what a badge MEANS), not which context rendered it — a
// badge's meaning doesn't change between light/dark, only whether the
// surrounding page is light or dark, and these tone colors already work on
// both (translucent bg + saturated text is legible on white and on #050505
// alike — confirmed by the existing order-status pills, which use this exact
// pattern today on the dark shell).
//
// Exported on its own (not just baked into badgeVariants below) so a call
// site that already owns its badge's structural classes — padding, size,
// rounding — can reuse just the color mapping instead of pulling in the cva
// wrapper's own structural classes, which would collide with classes already
// hardcoded at that call site. AdminApp's statusBadgeClasses() is exactly
// that case: it has always returned a bare color-pair string, and four call
// sites already supply their own (slightly different) size/padding/rounding
// around it.
export const BADGE_TONE_CLASSES = {
  neutral: 'bg-slate-500/10 text-slate-400',
  info: 'bg-blue-500/10 text-blue-400',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-rose-500/10 text-rose-400',
  brand: 'bg-[var(--mf-primary)]/10 text-[var(--mf-primary)]',
};

export const badgeVariants = cva('inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs', {
  variants: { tone: BADGE_TONE_CLASSES },
  defaultVariants: { tone: 'neutral' },
});

// ---------------------------------------------------------------------------
// Card — Phase A. Deliberately deferred in the STEP 2/3 foundation pass
// because three non-overlapping dark surface treatments already existed
// (`.glass-panel`, `.sa-card`, raw `bg-slate-900 border-slate-800`) and
// picking one would have been a visual-unification call made too early.
// Resolution: Card does NOT replace any of them — `.glass-panel`/`.sa-card`
// keep governing the surfaces that already opted into a glass look. Card
// fills the actual gap: the ~90 *un-owned* flat `bg-slate-900 border-slate-800
// rounded-2xl/3xl` literals scattered across AdminApp/StaffApp that never had
// a name. `interactive`/`selected` are booleans (not baked into `variant`)
// because both need to layer onto any of flat/elevated/danger/success.
// ---------------------------------------------------------------------------
export const cardVariants = cva(['rounded-2xl border', FOCUS_RING].join(' '), {
  variants: {
    context: { dark: '', customer: '' },
    variant: { flat: '', elevated: '', danger: '', success: '' },
    interactive: { true: 'cursor-pointer transition-colors', false: '' },
    selected: { true: '', false: '' },
  },
  compoundVariants: [
    { context: 'dark', variant: 'flat', class: 'bg-[var(--mf-surface)] border-[var(--mf-border)]' },
    { context: 'dark', variant: 'elevated', class: 'bg-[var(--mf-surface)] border-[var(--mf-border)] shadow-xl shadow-black/20' },
    { context: 'dark', variant: 'danger', class: 'bg-rose-500/5 border-rose-500/25' },
    { context: 'dark', variant: 'success', class: 'bg-emerald-500/5 border-emerald-500/25' },
    { context: 'dark', interactive: true, class: 'hover:border-slate-700 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
    { context: 'dark', selected: true, class: 'border-[var(--mf-primary)] ring-1 ring-[var(--mf-primary)]/40' },

    // Customer — own literals rather than delegating to `.customer-card`,
    // which hardcodes the hover-lift unconditionally. Card must be able to
    // render `flat` (no hover) as well as `interactive`, so the two states
    // can't share one CSS class the way Button/Input delegate to
    // `.customer-btn-primary` (which is always exactly one look).
    { context: 'customer', variant: 'flat', class: 'bg-white border-[#ECECEC]' },
    { context: 'customer', variant: 'elevated', class: 'bg-white border-[#ECECEC] shadow-[0_8px_30px_rgba(0,0,0,0.06)]' },
    { context: 'customer', variant: 'danger', class: 'bg-rose-50 border-rose-200' },
    { context: 'customer', variant: 'success', class: 'bg-emerald-50 border-emerald-200' },
    { context: 'customer', interactive: true, class: 'transition-all duration-300 hover:-translate-y-1 hover:border-[var(--theme-primary)]/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.10)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
    { context: 'customer', selected: true, class: 'border-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/40' },
  ],
  defaultVariants: { context: 'dark', variant: 'flat', interactive: false, selected: false },
});

// ---------------------------------------------------------------------------
// Modal — Phase A. Backdrop and panel are separate recipes because
// `position` changes the BACKDROP's flex alignment (center vs. drawer-right)
// as well as the panel's own shape, and cva compoundVariants read more
// clearly split this way than as one recipe with a dozen 3-way compounds.
// Colors/blur/rounding are lifted verbatim from the 5 hand-rolled overlays
// this replaces (3× AdminApp, ProductDetailModal, CartDrawer) — see the
// migration notes in Modal.jsx for the exact mapping.
// ---------------------------------------------------------------------------
export const modalBackdropVariants = cva(
  'fixed inset-0 flex backdrop-blur-sm motion-reduce:backdrop-blur-none',
  {
    variants: {
      // `customer` carries the literal `customer-theme` class, not just a
      // color — Modal never portals a customer-context dialog (see
      // Modal.jsx), but self-declaring the scope here too means it stays
      // correct even if a future call site renders one somewhere that
      // doesn't already sit inside a `.customer-theme` ancestor, exactly the
      // defensive pattern ProductDetailModal/CartDrawer already used before
      // this migration.
      context: { dark: 'bg-black/60', customer: 'customer-theme bg-black/40' },
      position: { center: 'items-center justify-center p-4', right: 'justify-end' },
      stacked: { true: 'z-[60]', false: 'z-50' },
    },
    defaultVariants: { context: 'dark', position: 'center', stacked: false },
  },
);

export const modalPanelVariants = cva(
  ['relative w-full overflow-y-auto no-scrollbar', 'motion-safe:transition-all motion-safe:duration-200'].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      position: { center: '', right: '' },
      size: { sm: '', md: '', lg: '', xl: '' },
    },
    compoundVariants: [
      { context: 'dark', position: 'center', class: 'bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl max-h-[90vh]' },
      { context: 'customer', position: 'center', class: 'bg-white border border-[#ECECEC] rounded-3xl max-h-[90vh]' },
      { position: 'center', size: 'sm', class: 'max-w-sm' },
      { position: 'center', size: 'md', class: 'max-w-md' },
      { position: 'center', size: 'lg', class: 'max-w-lg' },
      { position: 'center', size: 'xl', class: 'max-w-2xl' },
      // Drawer: flush to the right edge, full height, no max-w size preset —
      // CartDrawer's own max-w-md lives in its panelClassName override so the
      // one current consumer's exact width is preserved during migration.
      { position: 'right', class: 'h-full rounded-none' },
      { context: 'dark', position: 'right', class: 'bg-slate-900 border-l border-slate-800' },
      { context: 'customer', position: 'right', class: 'bg-white border-l border-[#ECECEC]' },
    ],
    defaultVariants: { context: 'dark', position: 'center', size: 'md' },
  },
);

// ---------------------------------------------------------------------------
// Alert — Phase A. Structural (padding/border/rounding), unlike Badge's pill
// shape, so it gets its own tone map rather than reusing BADGE_TONE_CLASSES
// (badges have no border; every existing alert-strip instance does). Colors
// are the literal values already used at AdminApp:565/1903 and DesignTab:94 —
// same "these read on light and dark alike" reasoning as BADGE_TONE_CLASSES
// (translucent bg + saturated-300 text), so no context variant needed.
// ---------------------------------------------------------------------------
export const ALERT_TONE_CLASSES = {
  info: 'bg-blue-500/10 border-blue-500/25 text-blue-300',
  success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  warning: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  danger: 'bg-rose-500/10 border-rose-500/25 text-rose-300',
};

export const alertVariants = cva('flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs sm:text-sm', {
  variants: { tone: ALERT_TONE_CLASSES },
  defaultVariants: { tone: 'info' },
});

// ---------------------------------------------------------------------------
// Tabs — Phase A. `accent` exists because StaffApp's two tabs are
// semantically different (orders = primary blue, alerts = warning amber,
// carried through to the badge count too) — collapsing that distinction to
// one accent would be a visual regression, not a cleanup.
// ---------------------------------------------------------------------------
export const tabsListVariants = cva('inline-flex items-center gap-1.5 rounded-xl border p-1.5', {
  variants: {
    context: {
      dark: 'bg-slate-950 border-slate-800',
      customer: 'bg-[var(--mf-bg-secondary)] border-[var(--mf-border)]',
    },
  },
  defaultVariants: { context: 'dark' },
});

export const tabsTriggerVariants = cva(
  ['px-5 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center gap-2', FOCUS_RING].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      active: { true: '', false: '' },
      accent: { primary: '', warning: '', danger: '', success: '' },
    },
    compoundVariants: [
      { context: 'dark', active: false, class: 'text-slate-400 hover:text-white hover:bg-slate-900 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-slate-950' },
      { context: 'dark', active: true, accent: 'primary', class: 'bg-[var(--mf-primary)] text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-slate-950' },
      { context: 'dark', active: true, accent: 'warning', class: 'bg-amber-600 text-white focus-visible:ring-amber-400 focus-visible:ring-offset-slate-950' },
      { context: 'dark', active: true, accent: 'danger', class: 'bg-rose-600 text-white focus-visible:ring-rose-400 focus-visible:ring-offset-slate-950' },
      { context: 'dark', active: true, accent: 'success', class: 'bg-emerald-600 text-white focus-visible:ring-emerald-400 focus-visible:ring-offset-slate-950' },

      { context: 'customer', active: false, class: 'text-[var(--mf-text-muted)] hover:text-[var(--mf-text)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'customer', active: true, accent: 'primary', class: 'bg-white text-[var(--mf-text)] shadow-sm focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
    ],
    defaultVariants: { context: 'dark', active: false, accent: 'primary' },
  },
);

// ---------------------------------------------------------------------------
// Navigation — the last gap in the primitive-kit checklist. Sidebar (vertical
// nav) and Tabs (in-page segmented nav) already existed; this fills the
// missing horizontal piece: a page header (title/description/actions) and
// breadcrumbs. Lifted from the ad hoc pattern repeated across every tab body
// today — AdminApp's `<h2 className="text-2xl font-serif-title font-bold
// text-white mb-6">`, SuperAdminApp's own `sa-heading-4` — which is exactly
// what the Master Plan (Phase B) already calls out as the remaining "page
// headers" gap. Built here as an opt-in primitive only; no existing page is
// wired to it in this pass (see Card/Modal/Alert/Tabs precedent: adoption
// happens when a file is already being touched for another reason).
// ---------------------------------------------------------------------------
export const pageHeaderVariants = cva('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', {
  variants: {
    context: { dark: '', customer: '' },
  },
  defaultVariants: { context: 'dark' },
});

export const pageHeaderTitleVariants = cva('font-serif-title font-bold text-2xl sm:text-3xl', {
  variants: {
    context: {
      dark: 'text-white',
      customer: 'text-[var(--mf-text)]',
    },
  },
  defaultVariants: { context: 'dark' },
});

export const pageHeaderDescriptionVariants = cva('mt-1 text-sm', {
  variants: {
    context: {
      dark: 'text-slate-400',
      customer: 'text-[var(--mf-text-muted)]',
    },
  },
  defaultVariants: { context: 'dark' },
});

export const breadcrumbLinkVariants = cva(
  ['inline-flex items-center rounded-md font-semibold transition-colors', FOCUS_RING].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      // `current` (the last crumb / the page you're on) is deliberately
      // non-interactive — re-navigating to where you already are isn't a
      // real action, matching how every other primitive here treats
      // "selected" state (Card/Tabs) as visually distinct, not clickable-away.
      current: { true: 'cursor-default', false: '' },
    },
    compoundVariants: [
      { context: 'dark', current: false, class: 'text-slate-500 hover:text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'dark', current: true, class: 'text-white' },
      { context: 'customer', current: false, class: 'text-[var(--mf-text-muted)] hover:text-[var(--mf-text)] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'customer', current: true, class: 'text-[var(--mf-text)]' },
    ],
    defaultVariants: { context: 'dark', current: false },
  },
);

// ---------------------------------------------------------------------------
// LanguageSwitcher — full-app AZ/EN/RU localization pass. The `customer`
// variant reproduces the exact pill/segmented control that already lived
// inline in CustomerApp.jsx (extracted, not redesigned, so that surface's
// visual output doesn't change) styled with literal hex values matching that
// component's existing header instead of `--mf-*` tokens (the header itself
// is white/light-chrome, not on the `.customer-theme` dark-on-light token
// surface). The `dark` variant reuses `--mf-*` tokens like every other
// dark-context primitive here, for Admin/Staff/SuperAdmin/Auth/Onboarding/
// Pricing chrome.
// ---------------------------------------------------------------------------
export const languageSwitcherContainerVariants = cva('inline-flex items-center rounded-2xl p-1 gap-1 shrink-0', {
  variants: {
    context: {
      dark: 'bg-[var(--mf-surface)] border border-[var(--mf-border)]',
      customer: 'bg-[#F7F8FA] border border-[#E8E8E8]',
    },
  },
  defaultVariants: { context: 'dark' },
});

export const languageSwitcherButtonVariants = cva(
  ['px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all duration-200', FOCUS_RING].join(' '),
  {
    variants: {
      context: { dark: '', customer: '' },
      active: { true: 'text-white', false: '' },
    },
    compoundVariants: [
      { context: 'dark', active: false, class: 'text-[var(--mf-text-muted)] hover:text-white focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'customer', active: false, class: 'text-[#8A8F98] hover:text-[#14151A] focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
      { context: 'dark', active: true, class: 'focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-[var(--mf-bg)]' },
      { context: 'customer', active: true, class: 'focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-white' },
    ],
    defaultVariants: { context: 'dark', active: false },
  },
);

// The active pill's background is a gradient, which cva/Tailwind can't
// express as a static class token the same way — kept as a plain style
// object constant (same reason CustomerApp's original inline switcher used
// `style=` instead of a class) so both contexts can reuse the identical
// active-state look without duplicating the gradient literal per call site.
export const LANGUAGE_SWITCHER_ACTIVE_STYLE = {
  dark: { background: 'var(--mf-primary)' },
  customer: { background: 'linear-gradient(180deg, #7B61FF 0%, #5B3DF5 100%)' },
};
