import { useEffect } from "react";
import { useLanguageStore } from "@/lib/i18n/languageStore";
import { updateMyLocale } from "@/lib/services/authService";

// Mounted once in AdminApp/StaffApp/SuperAdminApp, next to their existing
// profile-load effects. One-directional hydration only: if this browser has
// no explicit language choice yet, adopt the signed-in user's saved
// profiles.locale (migration 0023) — this is the actual cross-device sync.
// It never overwrites a choice already made in this browser (that would be
// surprising: you picked EN here, a re-fetch of your profile shouldn't snap
// it back to whatever you last picked on your phone).
export function useLocaleSync(locale) {
  useEffect(() => {
    if (!locale) return;
    const { language, hasExplicitPreference, setLanguage } = useLanguageStore.getState();
    if (!hasExplicitPreference && language !== locale) {
      setLanguage(locale, { explicit: false });
    }
  }, [locale]);
}

// Call from the language switcher's onChange handler. Updates the local
// store immediately (explicit = true, sticks in this browser) and — only
// when a signed-in profile exists — best-effort persists to
// profiles.locale so other devices pick it up next time they hydrate above.
// Customer/Auth/Onboarding/Pricing pass no profile (nobody is signed in
// yet there) and this is purely local, same as before this feature existed.
export function setLanguageAndSync(lang, profile) {
  useLanguageStore.getState().setLanguage(lang, { explicit: true });
  if (profile?.id) {
    updateMyLocale(lang);
  }
}
