"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Percent, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import {
  PageHeader, Card, CardHeader, CardBody, Field, Input, Select, Button, Badge, EmptyState,
  Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
} from "@/components/ui";

const emptyCampaign = { title: "", description: "", banner_image_url: "" };
const emptyDiscount = { title: "", discount_type: "percentage", value: "", product_id: "" };

// Admin -> Kampaniya + Endirim: kampaniyalar (bannerli tanıtımlar) və
// endirimlər (bütün menyuya və ya seçilmiş məhsula tətbiq olunan qiymət
// azalması) buradan idarə olunur.
export function PromotionsTab() {
  const { t } = useAdminTranslation();
  const {
    campaigns, loadCampaigns, createCampaign, deleteCampaign,
    discounts, loadDiscounts, createDiscount, deleteDiscount,
    products,
  } = useAppStore();

  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [discountForm, setDiscountForm] = useState(emptyDiscount);

  useEffect(() => {
    loadCampaigns();
    loadDiscounts();
  }, [loadCampaigns, loadDiscounts]);

  const handleAddCampaign = async (e) => {
    e.preventDefault();
    if (!campaignForm.title.trim()) return;
    await createCampaign({ ...campaignForm, is_active: true });
    setCampaignForm(emptyCampaign);
  };

  const handleAddDiscount = async (e) => {
    e.preventDefault();
    if (!discountForm.title.trim() || !discountForm.value) return;
    await createDiscount({
      title: discountForm.title,
      discount_type: discountForm.discount_type,
      value: Number(discountForm.value),
      product_id: discountForm.product_id || null,
      is_active: true,
    });
    setDiscountForm(emptyDiscount);
  };

  const productName = (id) => products.find((p) => p.id?.toString() === id?.toString())?.name;

  return (
    <div className="space-y-6">
      <PageHeader context="dark" title={t('titlePromotions')} description={t('promotionsSubtitle')} />

      {/* Campaigns */}
      <Card context="dark" variant="flat">
        <CardHeader>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-400" />
            {t('campaignsSectionTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleAddCampaign} className="grid sm:grid-cols-3 gap-3 mb-5">
            <Field context="dark" label={t('campaignNameFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  placeholder={t('campaignNamePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field context="dark" label={t('campaignDescFieldLabel')}>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder={t('campaignDescPlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field context="dark" label={t('campaignBannerUrlFieldLabel')}>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={campaignForm.banner_image_url}
                  onChange={(e) => setCampaignForm({ ...campaignForm, banner_image_url: e.target.value })}
                  placeholder={t('campaignBannerUrlPlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Button type="submit" size="block" className="sm:col-span-3">
              <Plus className="w-4 h-4" /> {t('addCampaignButton')}
            </Button>
          </form>

          {campaigns.length === 0 ? (
            <EmptyState icon={<Megaphone className="w-8 h-8 text-blue-400" />} title={t('noCampaignsYet')} description={t('campaignsNotFoundDescription')} />
          ) : (
            <Table>
              <TableHead>
                <TableHeaderCell>{t('colCampaign')}</TableHeaderCell>
                <TableHeaderCell>{t('colStatus')}</TableHeaderCell>
                <TableHeaderCell className="text-right">{t('colActions')}</TableHeaderCell>
              </TableHead>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-bold text-white">{c.title}</p>
                      {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge tone={c.is_active ? 'success' : 'neutral'}>
                        {c.is_active ? t('campaignActiveStatusBadge') : t('campaignInactiveStatusBadge')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <button onClick={() => deleteCampaign(c.id)} className="text-slate-500 hover:text-rose-400 p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
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
      <Card context="dark" variant="flat">
        <CardHeader>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <Percent className="w-5 h-5 text-emerald-400" />
            {t('discountsSectionTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleAddDiscount} className="grid sm:grid-cols-4 gap-3 mb-5">
            <Field context="dark" label={t('discountNameFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={discountForm.title}
                  onChange={(e) => setDiscountForm({ ...discountForm, title: e.target.value })}
                  placeholder={t('discountNamePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field context="dark" label={t('discountTypeFieldLabel')}>
              {(id, a11y) => (
                <Select
                  context="dark" id={id} value={discountForm.discount_type}
                  onChange={(e) => setDiscountForm({ ...discountForm, discount_type: e.target.value })} {...a11y}
                >
                  <option value="percentage">{t('discountTypePercentage')}</option>
                  <option value="fixed">{t('discountTypeFixed')}</option>
                </Select>
              )}
            </Field>
            <Field context="dark" label={t('discountValueFieldLabel')} required>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="number" step="0.01" min="0" value={discountForm.value}
                  onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                  placeholder={t('discountValuePlaceholder')} {...a11y}
                />
              )}
            </Field>
            <Field context="dark" label={t('discountProductFieldLabel')}>
              {(id, a11y) => (
                <Select
                  context="dark" id={id} value={discountForm.product_id}
                  onChange={(e) => setDiscountForm({ ...discountForm, product_id: e.target.value })} {...a11y}
                >
                  <option value="">{t('allMenuOption')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit" size="block" className="sm:col-span-4 bg-emerald-600 hover:bg-emerald-500">
              <Plus className="w-4 h-4" /> {t('addDiscountButton')}
            </Button>
          </form>

          {discounts.length === 0 ? (
            <EmptyState icon={<Percent className="w-8 h-8 text-emerald-400" />} title={t('noDiscountsYet')} description={t('discountsNotFoundDescription')} />
          ) : (
            <div className="space-y-2">
              {discounts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{d.title}</p>
                      <Badge tone={d.discount_type === 'percentage' ? 'info' : 'success'}>
                        {d.discount_type === 'percentage' ? `${d.value}%` : `${d.value} ₼`}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{d.product_id ? (productName(d.product_id) || t('productFallbackLabel')) : t('appliesAllMenu')}</p>
                  </div>
                  <button onClick={() => deleteDiscount(d.id)} className="text-slate-500 hover:text-rose-400 p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default PromotionsTab;
