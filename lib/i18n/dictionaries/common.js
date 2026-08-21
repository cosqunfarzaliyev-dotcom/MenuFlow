import { createTranslationHook } from '@/lib/i18n';

// Cross-panel strings genuinely shared by more than one surface. Same flat
// {az,en,ru} shape as lib/translations.js (the Customer dictionary) — that
// file is intentionally left alone, this is its sibling for every other
// surface.
//
// DELIBERATELY TINY. This file once declared 39 generic keys (delete/edit/
// close/add/yes/no/name/email/...) of which exactly three were ever called —
// pre-guessed wholesale, which its own header at the time said not to do.
// The other 36 were removed once scripts/verify-i18n-keys.mjs could prove
// it. Add a key here ONLY when a second surface actually needs the same
// string; a string used by one surface belongs in that surface's own
// dictionary, where it stays next to its call site.
export const common = {
  az: {
    save: "Yadda saxla",
    cancel: "Ləğv et",
    tryAgain: "Yenidən cəhd edin",
  },
  en: {
    save: "Save",
    cancel: "Cancel",
    tryAgain: "Try again",
  },
  ru: {
    save: "Сохранить",
    cancel: "Отмена",
    tryAgain: "Попробуйте снова",
  },
};

export const useCommonTranslation = createTranslationHook(common);
