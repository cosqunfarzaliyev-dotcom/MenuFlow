"use client";

// Next.js's last-resort boundary: a throw during render that took the whole
// tree down, including the root layout. It is the one place a React error can
// land that components/ErrorReporter.jsx cannot see (its listeners live in an
// effect that this failure prevented from ever running).
import React, { useEffect } from 'react';
import { reportClientError } from '@/lib/services/errorService';

export default function GlobalError({
  error,
  reset,
}) {
  useEffect(() => {
    reportClientError({
      message: error?.message || 'global-error',
      stack: error?.stack,
    });
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
