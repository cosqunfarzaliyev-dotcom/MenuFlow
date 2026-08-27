"use client";

// ---------------------------------------------------------------------------
// Mounted once in the root layout. Catches the two classes of failure a React
// error boundary does NOT see:
//
//   window 'error'              — throws outside React's render/commit cycle:
//                                 event handlers, timers, image/script loads.
//   'unhandledrejection'        — a rejected promise nobody caught, which is
//                                 how most failed Supabase calls actually
//                                 surface here.
//
// app/global-error.jsx covers the third class (a render that took the whole
// tree down) and reports through the same service.
//
// Renders nothing. Deliberately has no other job — this file must stay the
// kind of thing that cannot itself break a page.
// ---------------------------------------------------------------------------
import { useEffect } from 'react';
import { reportClientError } from '@/lib/services/errorService';

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event) => {
      reportClientError({
        message: event?.message || 'window.onerror',
        stack: event?.error?.stack,
      });
    };

    const onRejection = (event) => {
      const reason = event?.reason;
      reportClientError({
        message: reason?.message || String(reason || 'unhandledrejection'),
        stack: reason?.stack,
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}

export default ErrorReporter;
