import { create } from "zustand";
import { persist } from "zustand/middleware";

// Separate from lib/store.js's useAppStore on purpose: that store is
// documented (CLAUDE.md) as "not persisted" — folding a persisted concern
// into it would contradict that stated invariant for every other slice.
// This store owns exactly one thing: which of az/en/ru is the active UI
// language, persisted to localStorage so it survives reloads across every
// surface (Customer/Admin/Staff/SuperAdmin/Auth/Onboarding/Pricing).
//
// `hasExplicitPreference` distinguishes "the user picked this in this
// browser" from "this was hydrated from the signed-in user's profile" (see
// hooks/useLocaleSync.js). It's what lets a fresh browser pick up an
// account's saved language (profiles.locale, migration 0023) on first load,
// while never overwriting a choice already made in this browser.
export const useLanguageStore = create(
  persist(
    (set) => ({
      language: "az",
      hasExplicitPreference: false,
      setLanguage: (language, { explicit = true } = {}) =>
        set((state) => ({
          language,
          hasExplicitPreference: explicit || state.hasExplicitPreference,
        })),
    }),
    {
      name: "menuflow-language",
      // Only persist the two fields above — nothing else lives in this
      // store, but this keeps the persisted shape explicit and stable if
      // fields are ever added later.
      partialize: (state) => ({
        language: state.language,
        hasExplicitPreference: state.hasExplicitPreference,
      }),
    }
  )
);
