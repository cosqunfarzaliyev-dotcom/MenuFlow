"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { cardVariants } from './variants';

// Plain `<div>` by default; pass `as="button"` (or any element/component) to
// make the whole card the interactive target — e.g. a selectable table card
// in a future picker. `interactive` still has to be passed explicitly even
// when `as="button"`, since a non-interactive card can legitimately contain
// its own inner buttons (the common case today: a stat/info card with an
// "Edit" button inside it, where the CARD itself isn't clickable).
export const Card = React.forwardRef(function Card(
  { context, variant, interactive, selected, className, as: As = 'div', ...props },
  ref,
) {
  return (
    <As
      ref={ref}
      className={cn(cardVariants({ context, variant, interactive, selected }), className)}
      {...props}
    />
  );
});

// Thin structural helpers — optional. A Card's content is normal JSX; these
// exist only so a header/body/footer layout doesn't need its own ad hoc
// className every time (padding + a bottom border on Header/Footer, matching
// the divider pattern already used in the 5 modals this same phase adds).
export const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-4 sm:p-5 border-b border-[var(--mf-border)]', className)} {...props} />;
});

export const CardBody = React.forwardRef(function CardBody({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-4 sm:p-5', className)} {...props} />;
});

export const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-4 sm:p-5 border-t border-[var(--mf-border)]', className)} {...props} />;
});
