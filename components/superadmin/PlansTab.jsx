"use client";

// Plan Definition + Plan Features/Entitlements management (Master Plan
// Phase 9) — the SuperAdmin-side CRUD over the same `plans`/`plan_features`
// tables /pricing and the entitlement resolver read (see
// lib/services/planService.js's header comment and
// lib/services/entitlementService.js's hydratePlanFeatureDefaults()). A
// plan created or edited here is what shows up on /pricing and what a
// restaurant on that plan gets by default the moment it's saved — there is
// no separate "publish" step.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Edit2, X, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { createPlan, updatePlan, upsertPlanFeature } from '@/lib/services/planService';
import { FEATURE_REGISTRY, FEATURE_KEYS } from '@/lib/services/entitlementService';
import { formatMoney } from './constants';
import { useToast } from './Toast';
import { Field, Input, Button, Badge, EmptyState } from '@/components/ui';
import { useSuperAdminTranslation } from '@/lib/i18n/dictionaries/superadmin';

// Same override approach as RestaurantsTab.jsx — see that file's comment.
const FEATURE_LABEL_KEYS = {
  apple_pay: 'featureAppleyPayLabel',
  google_pay: 'featureGooglePayLabel',
  banners: 'featureBannersLabel',
};
const translatedFeatureLabel = (key, t) => t(FEATURE_LABEL_KEYS[key] || key);

// Same shape as RestaurantsTab.jsx's own modalMotion — kept as a local copy
// rather than imported from that file (a tab file importing from a sibling
// tab file for 4 lines of animation config is the wrong dependency to add;
// see that file for the original).
const modalMotion = {
  overlay: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  panel: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

function PlanModal({ title, initial, onClose, onSave }) {
  const { t } = useSuperAdminTranslation();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    key: initial?.key || '',
    name: initial?.name || '',
    description: initial?.description || '',
    priceMonthly: initial?.price_monthly ?? 0,
    priceYearly: initial?.price_yearly ?? 0,
    currency: initial?.currency || 'AZN',
    isActive: initial?.is_active !== false,
    sortOrder: initial?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.key.trim() || !form.name.trim()) return;
    setSaving(true);
    await onSave({
      ...form,
      key: form.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      priceMonthly: parseFloat(form.priceMonthly) || 0,
      priceYearly: parseFloat(form.priceYearly) || 0,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    });
    setSaving(false);
  };

  return (
    <motion.div {...modalMotion.overlay} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.form
        {...modalMotion.panel}
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-950 border border-slate-800 sa-radius-modal p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="sa-heading-4 text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <Field label={t('keyFieldLabel')} hint={isEdit ? t('keyImmutableHint') : undefined}>
          {(id, a11y) => (
            <Input
              id={id} {...a11y}
              value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={isEdit}
              placeholder={t('keyPlaceholder')}
              required
            />
          )}
        </Field>

        <Field label={t('nameFieldLabel')}>
          {(id, a11y) => (
            <Input id={id} {...a11y} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          )}
        </Field>

        {/* No Textarea primitive exists in components/ui — Field still wires
            up the label/id/aria (it works with any hand-rolled control per
            its own doc comment), the <textarea> itself keeps its raw
            styling since there's nothing to swap it for. */}
        <Field label={t('descriptionFieldLabel')}>
          {(id, a11y) => (
            <textarea
              id={id} {...a11y}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full bg-[var(--mf-surface)] border border-[var(--mf-border)] rounded-xl px-4 py-2.5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mf-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mf-bg)] resize-none"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('monthlyPriceLabel')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                type="number" min="0" step="0.01" value={form.priceMonthly}
                onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('yearlyPriceLabel')}>
            {(id, a11y) => (
              <Input
                id={id} {...a11y}
                type="number" min="0" step="0.01" value={form.priceYearly}
                onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('currencyFieldLabel')}>
            {(id, a11y) => (
              <Input id={id} {...a11y} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            )}
          </Field>
          <Field label={t('sortOrderFieldLabel')}>
            {(id, a11y) => (
              <Input id={id} {...a11y} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            )}
          </Field>
        </div>

        {/* Checkbox left as-is — no checkbox-aware primitive exists, and
            Input's own text-field styling would look wrong applied to one. */}
        <label className="flex items-center gap-2.5 py-1 cursor-pointer">
          <input
            type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-white font-semibold">{t('activeOnPricingLabel')}</span>
        </label>

        <Button type="submit" loading={saving} size="block">
          {t('saveButton')}
        </Button>
      </motion.form>
    </motion.div>
  );
}

// Per-plan feature toggle grid — instant-apply, same interaction pattern as
// RestaurantsTab.jsx's Switch (each toggle calls upsertPlanFeature()
// immediately, not tied to a form submit). Reads FEATURE_KEYS/FEATURE_REGISTRY
// so a feature added to the registry shows up here automatically, same
// reasoning as RestaurantsTab's own FEATURE_FLAG_META-driven Switch list.
function PlanFeatureToggles({ plan, planFeatures, onChange }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const [pendingKey, setPendingKey] = useState(null);

  const enabledByKey = {};
  for (const row of planFeatures) {
    if (row.plan_id === plan.id) enabledByKey[row.feature_key] = row.enabled;
  }

  const toggle = async (featureKey, nextValue) => {
    setPendingKey(featureKey);
    const { error } = await upsertPlanFeature({ planId: plan.id, featureKey, enabled: nextValue });
    setPendingKey(null);
    if (error) {
      notify(t('updateFailedToast')(error.message), 'error');
      return;
    }
    onChange?.();
  };

  return (
    <div className="space-y-0.5">
      {FEATURE_KEYS.map((key) => {
        const enabled = enabledByKey[key] ?? FEATURE_REGISTRY[key].defaultEnabled;
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-1.5">
            <p className="text-white text-xs font-semibold">{translatedFeatureLabel(key, t)}</p>
            <button
              type="button"
              disabled={pendingKey === key}
              onClick={() => toggle(key, !enabled)}
              aria-pressed={enabled}
              className={`relative shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function PlansTab({ plans, planFeatures, loading, refresh }) {
  const { t } = useSuperAdminTranslation();
  const notify = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  const handleSave = async (form) => {
    const { error } = editingPlan ? await updatePlan({ id: editingPlan.id, ...form }) : await createPlan(form);
    if (error) {
      notify(t('saveFailedToast')(error.message), 'error');
      return;
    }
    setIsCreateOpen(false);
    setEditingPlan(null);
    notify(editingPlan ? t('planUpdatedToast') : t('planCreatedToast'));
    refresh();
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="sa-caption text-slate-500">{t('loadingText')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="sa-caption text-slate-500">{plans.length} {t('planCountSuffix')}</p>
        <Button onClick={() => setIsCreateOpen(true)} className="shrink-0">
          <Plus className="w-4 h-4" /> {t('newPlanButton')}
        </Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8 text-slate-700" />}
          title={t('noPlansYet')}
          description=""
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan, i) => {
            const isExpanded = expandedPlanId === plan.id;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.25), duration: 0.3 }}
                className="sa-card p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-bold">{plan.name}</h3>
                      <Badge
                        tone={plan.is_active ? 'success' : 'neutral'}
                        className={`whitespace-nowrap border px-2 py-0.5 ${plan.is_active ? '' : 'bg-slate-800/60 text-slate-500 border-slate-700'}`}
                      >
                        {plan.is_active ? t('activeLabel') : t('inactiveLabel')}
                      </Badge>
                    </div>
                    <p className="sa-caption text-slate-500">{plan.key}</p>
                  </div>
                  <button onClick={() => setEditingPlan(plan)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white shrink-0" title={t('editTitle')}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {plan.description && <p className="text-xs text-slate-400 mb-3">{plan.description}</p>}

                <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                  <span className="text-white font-bold">
                    {formatMoney(plan.price_monthly, plan.currency)} <span className="text-slate-500 font-normal text-xs">{t('perMonthSuffix')}</span>
                  </span>
                  <span className="text-slate-500 text-xs">{formatMoney(plan.price_yearly, plan.currency)} {t('perYearSuffix')}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                  className="sa-caption font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {t('featuresToggleLabel')} {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <PlanFeatureToggles plan={plan} planFeatures={planFeatures} onChange={refresh} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isCreateOpen && (
          <PlanModal title={t('newPlanModalTitle')} onClose={() => setIsCreateOpen(false)} onSave={handleSave} />
        )}
        {editingPlan && (
          <PlanModal title={t('editPlanModalTitle')} initial={editingPlan} onClose={() => setEditingPlan(null)} onSave={handleSave} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default PlansTab;
