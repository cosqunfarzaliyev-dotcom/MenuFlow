"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Percent, Plus, Trash2, Edit2, X, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { useCommonTranslation } from "@/lib/i18n/dictionaries/common";
import {
  PageHeader, Card, CardHeader, CardBody, Field, Input, Select, Button, Tag, EmptyState, ConfirmDialog, useConfirmDialog,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/kit";

const emptyCampaign = { title: "", description: "", banner_image_url: "" };
const emptyDiscount = { title: "", discount_type: "percentage", value: "", product_id: "" };

// Admin -> Kampaniya + Endirim: kampaniyalar (bannerli tanıtımlar) və
// endirimlər (bütün menyuya və ya seçilmiş məhsula tətbiq olunan qiymət
// azalması) buradan idarə olunur.
export function PromotionsTab() {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  const {
    campaigns, loadCampaigns, createCampaign, updateCampaign, deleteCampaign,
    discounts, loadDiscounts, createDiscount, updateDiscount, deleteDiscount,
    products,
  } = useAppStore();
  const confirmDialog = useConfirmDialog();

  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [discountForm, setDiscountForm] = useState(emptyDiscount);
  const [editingDiscountId, setEditingDiscountId] = useState(null);

  useEffect(() => {
    loadCampaigns();
    loadDiscounts();
  }, [loadCampaigns, loadDiscounts]);

  // Create + edit share one form/handler — editingCampaignId set means Save
  // calls updateCampaign instead of createCampaign, same pattern
  // DesignTab.jsx already uses for banners (see its handleSaveBanner).
  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    if (!campaignForm.title.trim()) return;
    if (editingCampaignId) {
      await updateCampaign({ id: editingCampaignId, ...campaignForm });
    } else {
      await createCampaign({ ...campaignForm, is_active: true });
    }
    setCampaignForm(emptyCampaign);
    setEditingCampaignId(null);
  };

  const handleEditCampaign = (c) => {
    setEditingCampaignId(c.id);
    setCampaignForm({
      title: c.title || "",
      description: c.description || "",
      banner_image_url: c.banner_image_url || "",
    });
  };

  const handleCancelEditCampaign = () => {
    setEditingCampaignId(null);
    setCampaignForm(emptyCampaign);
  };

  const handleToggleCampaignActive = (c) => {
    updateCampaign({ id: c.id, is_active: !c.is_active });
  };

  const handleDeleteCampaign = (c) => {
    confirmDialog.confirm({
      title: t('deleteCampaignConfirmTitle'),
      message: t('deleteCampaignConfirmMessage')(c.title),
      onConfirm: () => deleteCampaign(c.id),
    });
  };

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

      {/* Campaigns */}
      <Card variant="plain">
        <CardHeader>
          <h2 className="font-semibold text-[var(--k-text)] flex items-center gap-2 text-sm">
            <Megaphone className="w-4 h-4 text-[var(--k-accent)]" />
            {t('campaignsSectionTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSaveCampaign} className="grid sm:grid-cols-3 gap-3 mb-5">
            <Field label={t('campaignNameFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  placeholder={t('campaignNamePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field label={t('campaignDescFieldLabel')}>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder={t('campaignDescPlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field label={t('campaignBannerUrlFieldLabel')}>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={campaignForm.banner_image_url}
                  onChange={(e) => setCampaignForm({ ...campaignForm, banner_image_url: e.target.value })}
                  placeholder={t('campaignBannerUrlPlaceholder')} {...a11y}
                />
              )}
            </Field>
            <div className="sm:col-span-3 flex gap-2">
              <Button type="submit" variant="primary" className="flex-1" icon={editingCampaignId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                {editingCampaignId ? t('saveChangesShort') : t('addCampaignButton')}
              </Button>
              {editingCampaignId && (
                <Button type="button" variant="secondary" onClick={handleCancelEditCampaign} icon={<X className="w-4 h-4" />}>
                  {tc('cancel')}
                </Button>
              )}
            </div>
          </form>

          {campaigns.length === 0 ? (
            <EmptyState icon={<Megaphone className="w-5 h-5" />} title={t('noCampaignsYet')} description={t('campaignsNotFoundDescription')} />
          ) : (
            <Table>
              <TableHead>
                <TableHeaderCell>{t('colCampaign')}</TableHeaderCell>
                <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t('colActions')}</TableHeaderCell>
              </TableHead>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} className={editingCampaignId === c.id ? 'bg-[var(--k-accent-soft)]' : undefined}>
                    <TableCell>
                      <p className="font-medium text-[var(--k-text)]">{c.title}</p>
                      {c.description && <p className="text-xs text-[var(--k-text-3)] mt-0.5">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Tag tone={c.is_active ? 'success' : 'neutral'}>
                        {c.is_active ? t('campaignActiveStatusBadge') : t('campaignInactiveStatusBadge')}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleToggleCampaignActive(c)}
                          aria-label={c.is_active ? t('deactivateCampaignAriaLabel')(c.title) : t('activateCampaignAriaLabel')(c.title)}
                          title={c.is_active ? t('bannerActiveTooltip') : t('bannerInactiveTooltip')}
                          className="text-[var(--k-text-3)] hover:text-[var(--k-text)] p-2 shrink-0"
                        >
                          {c.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEditCampaign(c)}
                          aria-label={t('editCampaignAriaLabel')(c.title)}
                          className="text-[var(--k-text-3)] hover:text-[var(--k-accent)] p-2 shrink-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(c)}
                          aria-label={t('deleteCampaignAriaLabel')(c.title)}
                          className="text-[var(--k-text-3)] hover:text-[var(--k-danger)] p-2 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

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
