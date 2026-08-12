"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { badgeVariants } from './variants';

export function Badge({ tone, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
