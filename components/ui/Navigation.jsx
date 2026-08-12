"use client";

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  pageHeaderVariants,
  pageHeaderTitleVariants,
  pageHeaderDescriptionVariants,
  breadcrumbLinkVariants,
} from './variants';

/**
 * Breadcrumbs — `items`: [{ label, onClick? }]. The last item always renders
 * as the current page (non-interactive, `aria-current="page"`) even if it
 * was given an `onClick` — re-navigating to the page you're already on isn't
 * a real action. Earlier items with no `onClick` render as plain text too
 * (e.g. a non-clickable ancestor step), same reasoning.
 */
export function Breadcrumbs({ context, items = [], className }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1.5 text-xs sm:text-sm', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const interactive = !isLast && typeof item.onClick === 'function';
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />}
            {interactive ? (
              <button
                type="button"
                onClick={item.onClick}
                className={breadcrumbLinkVariants({ context, current: false })}
              >
                {item.label}
              </button>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className={breadcrumbLinkVariants({ context, current: isLast })}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * PageHeader — the "consistent page headers" gap Master Plan Phase B already
 * names. Title + optional description on the left, an actions slot (buttons,
 * a search box, whatever the page needs) on the right, optional breadcrumbs
 * above both. Structural only, like Card's header/body/footer — it doesn't
 * own the spacing between itself and the content below; the call site's
 * existing rhythm (space-y-6, mb-6, ...) stays in charge of that.
 *
 * `title` renders as an <h1> — every current hand-rolled equivalent
 * (AdminApp's per-tab <h2>, StaffApp's <h1>, SuperAdminApp's <h1
 * className="sa-heading-4">) is the single heading for its page, so this
 * matches the more correct semantic level rather than copying whichever tag
 * happened to be used first.
 */
export function PageHeader({ context, title, description, breadcrumbs, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {breadcrumbs?.length ? <Breadcrumbs context={context} items={breadcrumbs} /> : null}
      <div className={pageHeaderVariants({ context })}>
        <div className="min-w-0">
          <h1 className={pageHeaderTitleVariants({ context })}>{title}</h1>
          {description ? <p className={pageHeaderDescriptionVariants({ context })}>{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
