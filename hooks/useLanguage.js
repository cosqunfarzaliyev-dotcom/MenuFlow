import { useLanguageStore } from "@/lib/i18n/languageStore";

// Thin hook mirroring the existing useFeature()/useCapability() shape
// (hooks/useEntitlement.js, hooks/useCapability.js) — subscribes to just the
// two fields components actually need, not the whole store object, so a
// language change re-renders exactly what reads this hook.
export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return { language, setLanguage };
}
