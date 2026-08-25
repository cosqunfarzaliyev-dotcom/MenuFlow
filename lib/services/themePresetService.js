// ---------------------------------------------------------------------------
// Customer-menu colour presets (Dizayn -> Theme Builder).
//
// A restaurant owner is not a designer. Four free-form colour pickers can
// produce an unreadable menu long before they produce a nice one, so the panel
// leads with ready-made palettes and treats the pickers as the refinement step
// rather than the starting point.
//
// These live in a service file, NOT in lib/i18n/dictionaries/: the hex values
// are content seeds, not UI chrome — the same split lib/site-content/defaults.js
// already keeps from dictionaries/marketing.js. Only the human-readable NAMES
// are translated, keyed by `themePreset{Key}Label` in dictionaries/admin.js.
//
// Every preset is checked by scripts/verify-theme-presets.mjs to clear the WCAG
// AA 4.5:1 contrast bar for body text on both the page background and the card
// surface — a shipped preset must never be the thing that makes a menu
// unreadable.
// ---------------------------------------------------------------------------

// The values .kit-light falls back to when a restaurant has never touched the
// Theme Builder. Kept here (not only in the migration) so the admin panel's
// "reset to defaults" button and the DB column defaults cannot drift apart.
export const DEFAULT_THEME = {
  background: '#FAFAF9',
  surface: '#FFFFFF',
  text: '#18181B',
  primary: '#6C4CFF',
};

export const THEME_PRESETS = [
  { key: 'classic', background: '#FAFAF9', surface: '#FFFFFF', text: '#18181B', primary: '#6C4CFF' },
  { key: 'cream',   background: '#FBF6EC', surface: '#FFFDF8', text: '#2B2419', primary: '#A26A26' },
  { key: 'night',   background: '#101418', surface: '#1A1F26', text: '#F2F2F0', primary: '#3D71CC' },
  { key: 'forest',  background: '#F2F6F1', surface: '#FFFFFF', text: '#16261C', primary: '#2F7D4F' },
  { key: 'ocean',   background: '#F0F5FA', surface: '#FFFFFF', text: '#132530', primary: '#0E6FA8' },
  { key: 'charcoal',background: '#1B1B1D', surface: '#252528', text: '#EDEDEC', primary: '#BE563F' },
];

export const THEME_PRESET_KEYS = THEME_PRESETS.map((p) => p.key);
