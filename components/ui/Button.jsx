"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './variants';

// `type` deliberately defaults to "button", not "submit" — a bare <button>
// inside a <form> submits by default, which is how an unlabeled toolbar
// button can accidentally trigger a form submit. Callers that want a submit
// button pass type="submit" explicitly, same as they do today.
//
// No `asChild`/Slot support — the repo has no Radix dependency and this kit
// isn't adding one. A <Link> or <a> that needs to look like a button calls
// `buttonVariants(...)` directly with `cn()`, e.g.:
//   <Link href="/" className={cn(buttonVariants({ variant: 'ghost' }))}>
//
// `loading` completes the form-states gap: today's submit buttons (login,
// DesignTab's banner/theme forms, ...) only ever do `disabled={submitting}`
// with no visual feedback beyond opacity. It's additive — no existing call
// site passes it, so `loading` defaulting to false renders byte-for-byte
// what this component rendered before. When true it shows a spinner (same
// Loader2 the codebase already uses for LoadingState/ErrorState/login),
// forces `disabled` so a slow request can't be double-submitted, and sets
// `aria-busy` for screen readers.
export const Button = React.forwardRef(function Button(
  { context, variant, size, className, type = 'button', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ context, variant, size }), className)}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});
