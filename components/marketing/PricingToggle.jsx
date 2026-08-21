"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/mkt/variants';
import { Card, CardBody, Badge, Tabs, TabsTrigger, EmptyState } from '@/components/mkt';

// Pure UI-state leaf (billingInterval: 'monthly' | 'yearly') — every string
// and every plan-derived number below is prepared SERVER-SIDE by
// app/[locale]/pricing/page.jsx and passed in as plain, serializable props.
// Deliberately NOT passed as props: `t` itself, or the pricing.js
// `yearlySavingsSuffix(pct)` FUNCTION value — functions cannot cross the
// Server -> Client Component boundary, so the server page already calls
// that function once per plan and hands this component the resulting
// STRING (`plan.yearlySavingsLabel`), not the function.
export function PricingToggle({ plans, labels, contactHref }) {
  const [billingInterval, setBillingInterval] = useState('monthly');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center mb-10">
        <h1 className="font-serif-title font-bold text-3xl sm:text-4xl text-[var(--mkt-text)] mb-3">{labels.pageTitle}</h1>
        <p className="text-[var(--mkt-text-2)] max-w-xl mx-auto mb-8">{labels.pageSubtitle}</p>

        <Tabs className="inline-flex">
          <TabsTrigger active={billingInterval === 'monthly'} onClick={() => setBillingInterval('monthly')}>
            {labels.monthlyTab}
          </TabsTrigger>
          <TabsTrigger active={billingInterval === 'yearly'} onClick={() => setBillingInterval('yearly')}>
            {labels.yearlyTab}
            <Badge tone="success" className="ml-1">{labels.yearlyDiscountBadge}</Badge>
          </TabsTrigger>
        </Tabs>
      </div>

      {plans.length === 0 ? (
        <EmptyState title={labels.noPlansFoundTitle} description={labels.noPlansFoundDescription} />
      ) : (
        <div className={cn('grid gap-6 max-w-3xl mx-auto', plans.length > 1 ? 'sm:grid-cols-2' : 'sm:max-w-sm')}>
          {plans.map((plan) => {
            const price = billingInterval === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            const showSavings = billingInterval === 'yearly' && plan.yearlySavingsLabel;

            return (
              <Card
                key={plan.id}
                variant={plan.isFeatured ? 'elevated' : 'flat'}
                className={cn('relative flex flex-col', plan.isFeatured && 'border-[var(--mkt-brass)]/50')}
              >
                {plan.isFeatured && (
                  <Badge tone="brand" className="absolute -top-3 left-1/2 -translate-x-1/2">{labels.mostPopularBadge}</Badge>
                )}
                <CardBody className="flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-[var(--mkt-text)] mb-1">{plan.name}</h3>
                  {plan.description && <p className="text-sm text-[var(--mkt-text-2)] mb-4">{plan.description}</p>}

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-[var(--mkt-text)]">{price}</span>
                    <span className="text-sm text-[var(--mkt-text-3)]">
                      {plan.currency} / {billingInterval === 'yearly' ? labels.perYearShort : labels.perMonthShort}
                    </span>
                  </div>
                  {showSavings ? (
                    <p className="text-xs text-[var(--mkt-sage)] font-bold mt-1 mb-4">{plan.yearlySavingsLabel}</p>
                  ) : (
                    <div className="mb-4" />
                  )}

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map(({ key, label, enabled }) => (
                      <li key={key} className="flex items-center gap-2.5 text-sm">
                        {enabled ? (
                          <Check className="w-4 h-4 text-[var(--mkt-sage)] shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-[var(--mkt-text-3)] shrink-0" />
                        )}
                        <span className={enabled ? 'text-[var(--mkt-text)]' : 'text-[var(--mkt-text-3)] line-through'}>{label}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={contactHref}
                    className={cn(buttonVariants({ variant: plan.isFeatured ? 'primary' : 'secondary', size: 'block' }), 'mt-6')}
                  >
                    {labels.getStartedButton}
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-[var(--mkt-text-3)] mt-10">{labels.signupFootnote}</p>
    </div>
  );
}

export default PricingToggle;
