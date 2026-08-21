import { useLanguageStore } from "./languageStore";
import { resolveTranslation } from "./resolve";

// Factory mirroring the hook-factory style already used in this codebase
// (useToast() in components/kit/Toast.jsx, useFeature()/useCapability() in
// hooks/useEntitlement.js and hooks/useCapability.js) — one dictionary per
// surface (see lib/i18n/dictionaries/*.js), each producing its own
// `useXTranslation()` hook so call sites don't have to pass the dictionary
// around by hand. Fallback chain (resolve.js) mirrors lib/translations.js's
// getLocalizedText: requested language -> az -> the raw key itself (so a
// missing translation degrades to a visible, greppable key rather than
// throwing or rendering blank). lib/i18n/server.js's getDictionary() shares
// this exact same chain for Server Components (app/[locale]/**).
export function createTranslationHook(dictionary) {
  return function useDictionaryTranslation() {
    const language = useLanguageStore((state) => state.language);
    const t = (key) => resolveTranslation(dictionary, language, key);
    return { t, language };
  };
}
