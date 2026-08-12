import { useLanguageStore } from "./languageStore";

// Factory mirroring the hook-factory style already used in this codebase
// (useToast() in components/ui/Toast.jsx, useFeature()/useCapability() in
// hooks/useEntitlement.js and hooks/useCapability.js) — one dictionary per
// surface (see lib/i18n/dictionaries/*.js), each producing its own
// `useXTranslation()` hook so call sites don't have to pass the dictionary
// around by hand. Fallback chain mirrors lib/translations.js's
// getLocalizedText: requested language -> az -> the raw key itself (so a
// missing translation degrades to a visible, greppable key rather than
// throwing or rendering blank).
export function createTranslationHook(dictionary) {
  return function useDictionaryTranslation() {
    const language = useLanguageStore((state) => state.language);
    const t = (key) => dictionary[language]?.[key] ?? dictionary.az?.[key] ?? key;
    return { t, language };
  };
}
