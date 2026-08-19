"use client";

// ---------------------------------------------------------------------------
// components/kit/primitives.jsx — the small, stateless pieces of the Quiet
// Premium kit. Grouped in one file because each is a handful of lines and a
// one-component-per-file split here buys nothing but import noise; the
// stateful ones (Sheet, Toast, ConfirmDialog) get their own files.
// ---------------------------------------------------------------------------
import React, { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buttonVariants, fieldControlVariants, labelVariants, tagVariants,
  cardVariants, bannerVariants, tabsListVariants, tabsTriggerVariants,
  pillVariants, FOCUS,
} from './variants';

/* ── Button ───────────────────────────────────────────────────────────────
   `type` defaults to "button" — a bare <button> inside a <form> submits, which
   is how an unlabeled toolbar icon can silently fire a submit. `loading`
   swaps the leading icon slot rather than appending a second spinner. */
export const Button = React.forwardRef(function Button(
  { variant, size, className, type = 'button', loading = false, disabled, icon, children, ...props },
  ref,
) {
  const iconOnly = size === 'icon' || size === 'iconSm';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading
        ? <Loader2 className={cn('animate-spin shrink-0', iconOnly ? 'w-4 h-4' : 'w-3.5 h-3.5')} aria-hidden="true" />
        : icon}
      {!iconOnly && children}
      {iconOnly && !loading && children}
    </button>
  );
});

/* ── Field / Input / Select / Textarea ────────────────────────────────────
   Field owns the label↔control id wiring via a render prop, so it composes
   with any control — including ones the kit doesn't ship. */
export function Field({ label, hint, error, required, className, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={id} className={labelVariants()}>
          {label}
          {required && <span className="text-[var(--k-danger)] ml-0.5">*</span>}
        </label>
      )}
      {children(id, {
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error) || undefined,
        required,
      })}
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-[var(--k-text-3)]">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-[var(--k-danger)]">{error}</p>}
    </div>
  );
}

export const Input = React.forwardRef(function Input(
  { size, invalid, className, htmlSize, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      size={htmlSize}
      className={cn(fieldControlVariants({ size, invalid }), className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef(function Select(
  { size, invalid, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldControlVariants({ size, invalid }), 'appearance-none bg-no-repeat pr-9', className)}
      style={{
        // Chevron drawn as a data-URI so it inherits the token colour without
        // an extra wrapper element around every select in the app.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A1A1A6' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.65rem center',
        backgroundSize: '1rem',
        ...props.style,
      }}
      {...props}
    >
      {children}
    </select>
  );
});

/* Textarea — the older kit had none, so every long-text field in the app is a
   raw <textarea> with its own copy of the input styling. */
export const Textarea = React.forwardRef(function Textarea({ invalid, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldControlVariants({ size: 'area', invalid }), className)}
      {...props}
    />
  );
});

/* Checkbox — also absent from the older kit (AdminApp's product modal hand-
   rolls four of them). Native input kept for form semantics and a11y; the
   visual box is a sibling so the check can be styled. */
export const Checkbox = React.forwardRef(function Checkbox({ label, className, ...props }, ref) {
  return (
    <label className={cn('inline-flex items-center gap-2.5 cursor-pointer select-none group', className)}>
      <span className="relative inline-flex shrink-0">
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className={cn(
            'w-[18px] h-[18px] rounded-[5px] border border-[var(--k-border-2)] bg-[var(--k-surface-2)]',
            'transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)]',
            'group-hover:border-[var(--k-text-3)]',
            'peer-checked:bg-[var(--k-accent)] peer-checked:border-[var(--k-accent)]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--k-focus)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--k-bg)]',
            'peer-disabled:opacity-45',
            "after:content-[''] after:absolute after:left-[6px] after:top-[2px] after:w-[5px] after:h-[10px]",
            'after:border-r-2 after:border-b-2 after:border-[var(--k-accent-fg)] after:rotate-45',
            'after:opacity-0 peer-checked:after:opacity-100 after:transition-opacity',
          )}
        />
      </span>
      {label && <span className="text-sm text-[var(--k-text)]">{label}</span>}
    </label>
  );
});

/* Switch — third gap in the older kit. SuperAdmin and PlansTab each hand-roll
   their own; this is that same shape with the pending/disabled state built in. */
export function Switch({ checked, onChange, disabled, label, description, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2', className)}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-[var(--k-text)]">{label}</span>}
          {description && <span className="block text-xs text-[var(--k-text-3)] mt-0.5">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-label={typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative shrink-0 w-10 h-6 rounded-full border',
          'transition-colors duration-[var(--k-dur)] ease-[var(--k-ease)]',
          'disabled:opacity-45 disabled:pointer-events-none',
          FOCUS,
          checked
            ? 'bg-[var(--k-accent)] border-[var(--k-accent)]'
            : 'bg-[var(--k-surface-3)] border-[var(--k-border-2)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            // `left-[3px]` is load-bearing, not decorative padding: with no
            // left/right set at all, an absolutely positioned element falls
            // back to its "static position", which measured out flush
            // against the track's RIGHT edge in this browser rather than
            // the left — confirmed live (off state rendered with a 23px gap
            // on the left and 1px on the right, and the checked state's
            // thumb overflowed 14px past the track entirely). Anchoring
            // explicitly at the left and translating a fixed 18px from
            // there removes that fallback ambiguity; 0/18 (not 3/18) since
            // the 3px offset now lives in `left` itself.
            'absolute left-[3px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white',
            'transition-transform duration-[var(--k-dur)] ease-[var(--k-ease)]',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

/* ── Tag ──────────────────────────────────────────────────────────────── */
export function Tag({ tone, size, className, children, ...props }) {
  return (
    <span className={cn(tagVariants({ tone, size }), className)} {...props}>
      {children}
    </span>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────── */
export const Card = React.forwardRef(function Card(
  { variant, interactive, selected, className, as: As = 'div', ...props },
  ref,
) {
  return (
    <As ref={ref} className={cn(cardVariants({ variant, interactive, selected }), className)} {...props} />
  );
});

export function CardHeader({ className, title, description, actions, children, ...props }) {
  // Either pass title/description/actions, or arbitrary children — both shapes
  // occur across the four panels and neither is worth a second component.
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--k-border)]', className)} {...props}>
      {children ?? (
        <>
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-[var(--k-text)] truncate">{title}</h3>}
            {description && <p className="text-xs text-[var(--k-text-3)] mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </>
      )}
    </div>
  );
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('px-4 sm:px-5 py-3.5 border-t border-[var(--k-border)]', className)} {...props} />;
}

/* ── Banner ───────────────────────────────────────────────────────────── */
export function Banner({ tone = 'neutral', icon, action, className, children, ...props }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(bannerVariants({ tone }), className)}
      {...props}
    >
      {icon && <span className="shrink-0 mt-px">{icon}</span>}
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Tabs / Pills ─────────────────────────────────────────────────────── */
export function Tabs({ className, children, ...props }) {
  return (
    <div role="tablist" className={cn(tabsListVariants(), className)} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({ active = false, className, children, ...props }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={cn(tabsTriggerVariants({ active }), className)} {...props}>
      {children}
    </button>
  );
}

export function Pill({ active = false, className, children, ...props }) {
  return (
    <button type="button" aria-pressed={active} className={cn(pillVariants({ active }), className)} {...props}>
      {children}
    </button>
  );
}

/* ── PageHeader ───────────────────────────────────────────────────────── */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-[22px] font-semibold text-[var(--k-text)] tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-[var(--k-text-3)]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Table ────────────────────────────────────────────────────────────── */
export function Table({ className, children, ...props }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm border-collapse', className)} {...props}>{children}</table>
    </div>
  );
}

export function TableHead({ className, children, ...props }) {
  return (
    <thead className={cn('bg-[var(--k-surface-2)]', className)} {...props}>
      <tr className="text-left">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({ className, children, ...props }) {
  return (
    <th className={cn('px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--k-text-3)] whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  );
}

export function TableBody({ children, ...props }) {
  return <tbody {...props}>{children}</tbody>;
}

export function TableRow({ className, children, ...props }) {
  return (
    <tr
      className={cn('border-t border-[var(--k-border)] transition-colors duration-[var(--k-dur)] hover:bg-[var(--k-surface-2)]', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ className, children, ...props }) {
  return <td className={cn('px-4 py-3 text-[var(--k-text-2)] align-middle', className)} {...props}>{children}</td>;
}

export function TableEmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-[13px] text-[var(--k-text-3)]">{children}</td>
    </tr>
  );
}

/* ── Divider / Skeleton ───────────────────────────────────────────────── */
export function Divider({ className }) {
  return <div role="separator" className={cn('h-px bg-[var(--k-border)]', className)} />;
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-[var(--k-r-sm)] bg-[var(--k-surface-3)]', className)} />;
}
