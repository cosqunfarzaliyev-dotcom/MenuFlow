"use client";

import React, { Suspense } from 'react';
import { SuperAdminApp } from '@/components/SuperAdminApp';
import { PageSkeleton } from '@/components/kit';

// Suspense boundary is required as of Next 15+: SuperAdminApp now reads
// useSearchParams() (Phase 4, mode/tab URL plumbing — see
// components/SuperAdminApp.jsx's header comment) and a Client Component
// calling that hook must have a Suspense ancestor or the build fails.
// Same precedent as app/login/page.jsx's own LoginPageContent/Suspense split.
export default function SuperAdminPage() {
  return (
    <Suspense fallback={<PageSkeleton className="kit-dark" />}>
      <SuperAdminApp />
    </Suspense>
  );
}
