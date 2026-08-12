"use client";

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { labelVariants } from './variants';

// Owns the label<->control id wiring the codebase is currently missing
// entirely (28 <label> elements with zero htmlFor in the components tree).
// `children` is a render prop — `(id) => <Input id={id} .../>` — rather than
// cloning a single child element, so Field works with any control (Input,
// Select, or a hand-rolled one) without assuming its prop shape.
//
// `success` is additive (parallel to `hint`/`error`, defaults undefined) —
// completes form-states coverage by giving a field a positive confirmation
// message, not just an error one. Precedence: error > success > hint, since
// a field can't be simultaneously broken and confirmed-good, and a generic
// hint stops being useful once either fires.
export function Field({ label, hint, error, success, required, context, className, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const successId = success ? `${id}-success` : undefined;
  const describedBy = [hintId, errorId, successId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('text-left', className)}>
      {label && (
        <label htmlFor={id} className={labelVariants({ context })}>
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {children(id, { 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) || undefined, required })}
      {hint && !error && !success && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-semibold text-rose-500">{error}</p>
      )}
      {success && !error && (
        <p id={successId} className="mt-1 text-xs font-semibold text-emerald-500">{success}</p>
      )}
    </div>
  );
}
