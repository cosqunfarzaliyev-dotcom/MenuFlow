"use client";

import React, { useEffect, useState } from "react";
import { Percent, Plus, Trash2, Edit2, X, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { useCommonTranslation } from "@/lib/i18n/dictionaries/common";
import {
  PageHeader, Card, CardHeader, CardBody, Field, Input, Select, Button, Tag, EmptyState, ConfirmDialog, useConfirmDialog,
} from "@/components/kit";

const emptyDiscount = { title: "", discount_type: "percentage", value: "", product_id: "" };

// Admin -> Endirimlər: bütün menyuya və ya seçilmiş bir məhsula tətbiq
// olunan qiymət azalmaları buradan idarə olunur. Promo şəkilləri artıq
// yalnız Dizayn -> Banner sistemindən gəlir (kampaniyalar silinib).
export function PromotionsTab() {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  const {
    discounts, loadDiscounts, createDiscount, updateDiscount, deleteDiscount,
    products,
  } = useAppStore();
  const confirmDialog = useConfirmDialog();

  const [discountForm, setDiscountForm] = useState(emptyDiscount);
  const [editingDiscountId, setEditingDiscountId] = useState(null);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const handleSaveDiscount = async (e) => {
    e.preventDefault();
    if (!discountForm.title.trim() || !discountForm.value) return;
    const payload = {
      title: discountForm.title,
      discount_type: discountForm.discount_type,
      value: Number(discountForm.value),
      product_id: discountForm.product_id || null,
    };
    if (editingDiscountId) {
      await updateDiscount({ id: editingDiscountId, ...payload });
    } else {
      await createDiscount({ ...payload, is_active: true });
    }
    setDiscountForm(emptyDiscount);
    setEditingDiscountId(null);
  };

  const handleEditDiscount = (d) => {
    setEditingDiscountId(d.id);
    setDiscountForm({
      title: d.title || "",
      discount_type: d.discount_type || "percentage",
      value: d.value?.toString() || "",
      product_id: d.product_id?.toString() || "",
    });
  };

  const handleCancelEditDiscount = () => {
    setEditingDiscountId(null);
    setDiscountForm(emptyDiscount);
  };

  const handleToggleDiscountActive = (d) => {
    updateDiscount({ id: d.id, is_active: !d.is_active });
  };

  const handleDeleteDiscount = (d) => {
    confirmDialog.confirm({
      title: t('deleteDiscountConfirmTitle'),
      message: t('deleteDiscountConfirmMessage')(d.title),
      onConfirm: () => deleteDiscount(d.id),
    });
  };

  const productName = (id) => products.find((p) => p.id?.toString() === id?.toString())?.name;

  return (
    <div className="space-y-6">
      <PageHeader title={t('titlePromotions')} description={t('promotionsSubtitle')} />

      {/* Discounts */}
      <Card variant="plain">
        <CardHeader>
          <h2 className="font-semibold text-[var(--k-text)] flex items-center gap-2 text-sm">
            <Percent className="w-4 h-4 text-[var(--k-success)]" />
            {t('discountsSectionTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSaveDiscount} className="grid sm:grid-cols-4 gap-3 mb-5">
            <Field label={t('discountNameFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={discountForm.title}
                  onChange={(e) => setDiscountForm({ ...discountForm, title: e.target.value })}
                  placeholder={t('discountNamePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field label={t('discountTypeFieldLabel')}>
              {(id, a11y) => (
                <Select
                  id={id} value={discountForm.discount_type}
                  onChange={(e) => setDiscountForm({ ...discountForm, discount_type: e.target.value })} {...a11y}
                >
                  <option value="percentage">{t('discountTypePercentage')}</option>
                  <option value="fixed">{t('discountTypeFixed')}</option>
                </Select>
              )}
            </Field>
            <Field label={t('discountValueFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  id={id} type="number" step="0.01" min="0" value={discountForm.value}
                  onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                  placeholder={t('discountValuePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field label={t('discountProductFieldLabel')}>
              {(id, a11y) => (
                <Select
                  id={id} value={discountForm.product_id}
                  onChange={(e) => setDiscountForm({ ...discountForm, product_id: e.target.value })} {...a11y}
                >
                  <option value="">{t('allMenuOption')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="sm:col-span-4 flex gap-2">
              <Button type="submit" variant="primary" className="flex-1" icon={editingDiscountId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                {editingDiscountId ? t('saveChangesShort') : t('addDiscountButton')}
              </Button>
              {editingDiscountId && (
                <Button type="button" variant="secondary" onClick={handleCancelEditDiscount} icon={<X className="w-4 h-4" />}>
                  {tc('cancel')}
                </Button>
              )}
            </div>
          </form>

          {discounts.length === 0 ? (
            <EmptyState icon={<Percent className="w-5 h-5" />} title={t('noDiscountsYet')} description={t('discountsNotFoundDescription')} />
          ) : (
            <div className="space-y-2">
              {discounts.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 bg-[var(--k-surface-2)] border rounded-[var(--k-r)] p-3 ${editingDiscountId === d.id ? 'border-[var(--k-accent)]/60' : 'border-[var(--k-border)]'} ${d.is_active ? '' : 'opacity-60'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[var(--k-text)] truncate">{d.title}</p>
                      <Tag tone={d.discount_type === 'percentage' ? 'info' : 'success'}>
                        {d.discount_type === 'percentage' ? `${d.value}%` : `${d.value} ₼`}
                      </Tag>
                      {!d.is_active && <Tag tone="neutral">{t('discountInactiveStatusBadge')}</Tag>}
                    </div>
                    <p className="text-xs text-[var(--k-text-3)] truncate">{d.product_id ? (productName(d.product_id) || t('productFallbackLabel')) : t('appliesAllMenu')}</p>
                  </div>
                  <button
                    onClick={() => handleToggleDiscountActive(d)}
                    aria-label={d.is_active ? t('deactivateDiscountAriaLabel')(d.title) : t('activateDiscountAriaLabel')(d.title)}
                    title={d.is_active ? t('bannerActiveTooltip') : t('bannerInactiveTooltip')}
                    className="text-[var(--k-text-3)] hover:text-[var(--k-text)] p-2 shrink-0"
                  >
                    {d.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEditDiscount(d)}
                    aria-label={t('editDiscountAriaLabel')(d.title)}
                    className="text-[var(--k-text-3)] hover:text-[var(--k-accent)] p-2 shrink-0"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDiscount(d)}
                    aria-label={t('deleteDiscountAriaLabel')(d.title)}
                    className="text-[var(--k-text-3)] hover:text-[var(--k-danger)] p-2 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}

export default PromotionsTab;
