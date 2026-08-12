"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { inputVariants } from './variants';

// `size` collides with the native <input size> attribute (character-width
// hint), so it's reserved here for the visual size variant. A caller that
// genuinely needs the HTML attribute passes `htmlSize`.
//
// `valid` is the success-state counterpart to `invalid` (see variants.js) —
// additive, defaults undefined, no existing call site passes it. Passing
// both is a caller error; `invalid` wins, since flagging a field as broken
// should never be silently overridden by a stale success flag.
export const Input = React.forwardRef(function Input(
  { context, size, invalid, valid, className, htmlSize, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      size={htmlSize}
      aria-invalid={invalid || undefined}
      className={cn(inputVariants({ context, size, invalid, valid: invalid ? false : valid }), className)}
      {...props}
    />
  );
});
