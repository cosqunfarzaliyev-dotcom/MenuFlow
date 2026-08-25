import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Azerbaijani-aware folding for free-text search boxes.
//
// Plain .toLowerCase() is wrong for this menu in two ways:
//   1. 'İ'.toLowerCase() is "i" + U+0307 (a COMBINING DOT ABOVE), not a
//      plain "i" — so typing "isti" never matched "İsti içkilər".
//      toLocaleLowerCase('az') maps İ -> i and I -> ı correctly.
//   2. An admin typing on a phone often has no Azerbaijani layout, so
//      "sorba" should still find "Şorbalar" and "coban" "Çoban Salatı".
//      NFD + dropping combining marks folds ç ğ ö ş ü onto their base letters.
//
// ə and ı have no Unicode decomposition (they are distinct letters, not
// accented forms), so they need the explicit map below — without it "meze"
// would miss "Məzə Tabağı", which is a very ordinary thing to type.
//
// Folding is deliberately one-way and lossy: it is only ever used to compare
// a query against a label, never to store or display anything.
const AZ_SEARCH_FOLD = { 'ə': 'e', 'ı': 'i' };

export function foldForSearch(value) {
  return (value || '')
    .toLocaleLowerCase('az')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[əı]/g, (ch) => AZ_SEARCH_FOLD[ch])
    .trim();
}

// True when `haystack` contains `query` under the folding above. An empty
// query matches everything, so callers can pass the raw input straight in.
export function matchesSearch(haystack, query) {
  const needle = foldForSearch(query);
  if (!needle) return true;
  return foldForSearch(haystack).includes(needle);
}

// Banner media (Dizayn -> Banner sistemi) can now be a short looping video
// instead of a static image. There is no separate "media type" column —
// uploads always go through uploadRestaurantImage(), which names the object
// after the file's own real extension, so a video upload naturally produces
// a .mp4/.webm/.mov URL and an image upload a .jpg/.png/.webp/.gif one.
// Reading the extension back out is enough to tell them apart at render
// time, both here and for a pasted external URL — no DB migration, no extra
// round trip. A URL with no recognizable extension (e.g. a bare query-string
// CDN link) falls through to the image path, exactly the same "try to
// render it as an image, show the broken-media badge if that fails"
// behaviour a bad image URL already gets today, so this is not a new
// failure mode.
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];

export function isVideoUrl(url) {
  if (!url) return false;
  const withoutQuery = url.split(/[?#]/)[0];
  const ext = withoutQuery.split('.').pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

// ---------------------------------------------------------------------------
// Customer-menu theming (0043_customer_theme_colors.sql)
// ---------------------------------------------------------------------------

// Parse "#RGB" / "#RRGGBB" into {r,g,b} 0-255, or null when unparseable.
// Deliberately tolerant: these strings come from a DB column an admin typed
// into, so a half-finished "#12" must not throw on a customer's menu.
function parseHex(hex) {
  const raw = (hex || '').trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

// WCAG relative luminance (sRGB -> linear, then the standard coefficients).
// Not a perceptual-lightness shortcut like (r+g+b)/3: pure yellow and pure
// blue have almost the same naive average but wildly different luminance, and
// the button-label decision below turns on exactly that difference.
export function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Contrast ratio between two hex colours (1..21), per WCAG 2.x. Returns null
// if either colour is unparseable.
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// Black or white, whichever is more readable ON `backgroundHex`.
//
// This is the one theming decision CSS cannot make for us: color-mix() only
// blends two colours, and color-contrast() still is not broadly supported. It
// feeds --theme-accent-fg (the button LABEL colour) so a restaurant that picks
// a pale button never ends up with white-on-pale text. The 0.5 threshold is
// compared against luminance, not lightness, for the reason in the comment
// above relativeLuminance.
export function pickReadableForeground(backgroundHex, { light = '#FFFFFF', dark = '#18181B' } = {}) {
  const lum = relativeLuminance(backgroundHex);
  if (lum === null) return light;
  return lum > 0.5 ? dark : light;
}
