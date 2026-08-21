// ---------------------------------------------------------------------------
// The one fallback chain every translation lookup in this codebase uses:
// requested language -> az -> the raw key itself (a missing key degrades to
// a visible, greppable string rather than throwing or rendering blank).
//
// Extracted out of lib/i18n/index.js's createTranslationHook() (the CLIENT
// hook factory, still the only consumer for every panel/`ui`-era dictionary)
// so lib/i18n/server.js (the SERVER Component reader, used by
// app/[locale]/** for the marketing site) can share the exact same logic —
// two copies of this one-liner would inevitably drift the moment either
// side got a "helpful" tweak.
// ---------------------------------------------------------------------------
export function resolveTranslation(dictionary, language, key) {
  return dictionary[language]?.[key] ?? dictionary.az?.[key] ?? key;
}
