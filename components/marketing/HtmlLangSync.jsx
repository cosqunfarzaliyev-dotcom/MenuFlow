"use client";

import { useEffect } from 'react';

// The root <html lang> (app/layout.jsx) is hardcoded to "az" — Next.js
// renders exactly one root layout for the whole app (panels, /login, /menu
// AND the marketing site all share it), so a Server Component under
// app/[locale]/** has no way to change that attribute itself; only the
// actual root layout controls <html>. Fixing this "for real" (a separate
// root layout per route group, each with its own server-rendered lang) is a
// bigger structural move — this is the small, low-risk stopgap: sync
// document.documentElement.lang to the URL's locale on mount.
//
// This is NOT purely cosmetic. Google's indexer renders the page's JS before
// reading it, so this DOES fix the lang signal for ranking/hreflang
// consistency — it just does it a tick after first paint instead of in the
// initial HTML, which is the one gap a non-JS crawler or lang-sniffing tool
// would still see.
export function HtmlLangSync({ locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    // Nothing to restore on unmount — the marketing layout is the only
    // consumer, and every navigation within it re-runs this effect with the
    // new locale anyway.
  }, [locale]);

  return null;
}
