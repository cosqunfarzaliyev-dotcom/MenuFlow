"use client";

import { useEffect } from 'react';

// Registers the shared service worker (public/sw.js) the first time any of
// the three installable panels (/admin, /staff, /superadmin) is opened.
// Silently no-ops if the browser doesn't support service workers (older
// webviews on some POS tablets) — installability just won't be offered.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}

export default PwaRegister;
