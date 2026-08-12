"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { selectVariants } from './variants';

// `valid` mirrors Input's success-state prop — see Input.jsx for the
// precedence note (invalid wins if both are somehow passed).
export const Select = React.forwardRef(function Select(
  { context, size, invalid, valid, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(selectVariants({ context, size, invalid, valid: invalid ? false : valid }), className)}
      {...props}
    >
      {children}
    </select>
  );
});
