// ---------------------------------------------------------------------------
// Server-side i18n for the marketing site (app/[locale]/**).
//
// On /[locale]/*, the URL is the ONLY source of truth for language — no
// component under app/[locale]/ may call useLanguage()/useMarketingTranslation()
// (those read lib/i18n/languageStore.js, a client-side Zustand store).
// Everywhere else (panels, /login, /menu), languageStore stays authoritative,
// completely untouched by this file.
//
// marketing.js/pricing.js already export a plain `{ az, en, ru }` object —
// only their `useXTranslation()` hook is client-only, so a Server Component
// can import the dictionary object directly and resolve through it here.
// ---------------------------------------------------------------------------
import { marketing } from './dictionaries/marketing';
import { pricing } from './dictionaries/pricing';
import { resolveTranslation } from './resolve';

export const LOCALES = ['az', 'en', 'ru'];
export const DEFAULT_LOCALE = 'az';

export const isLocale = (value) => LOCALES.includes(value);

// Hand-rolled RFC 4647-ish q-value parse over exactly the three locales this
// app supports — deliberately not @formatjs/intl-localematcher + negotiator
// (two new dependencies for a ~15-line function in a repo with 17 runtime
// deps). "Accept-Language: en-US,en;q=0.9,az;q=0.8" -> 'en'; anything
// unparsable or with no match at all -> DEFAULT_LOCALE.
export function negotiateLocale(acceptLanguageHeader) {
  if (!acceptLanguageHeader) return DEFAULT_LOCALE;

  const ranked = acceptLanguageHeader
    .split(',')
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      // "en-US" -> "en" — we only ever match on the primary subtag since
      // LOCALES has no region variants.
      const primary = rawTag.trim().split('-')[0].toLowerCase();
      return { primary, q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { primary } of ranked) {
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

// requested -> az -> raw key, identical chain to the client hook
// (lib/i18n/index.js's createTranslationHook), so a Server Component's
// output and a Client Component's output for the same key can never diverge.
export function getDictionary(locale, dict) {
  const safeLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return {
    t: (key) => resolveTranslation(dict, safeLocale, key),
    locale: safeLocale,
  };
}

export const getMarketingDictionary = (locale) => getDictionary(locale, marketing);
export const getPricingDictionary = (locale) => getDictionary(locale, pricing);
