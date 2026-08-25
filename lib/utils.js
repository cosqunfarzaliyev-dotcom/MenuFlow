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
