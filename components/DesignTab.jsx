"use client";

import React, { useEffect, useState } from "react";
import { Palette, Image as ImageIcon, Plus, Trash2, CheckCircle2, Edit2, X, Eye, EyeOff, Video } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { isVideoUrl } from "@/lib/utils";
import { FEATURES } from "@/lib/services/entitlementService";
import { useFeature } from "@/hooks/useEntitlement";
import { CAPABILITIES } from "@/lib/services/capabilityService";
import { useCapability } from "@/hooks/useCapability";
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Select, Field, Banner, EmptyState, ConfirmDialog, useConfirmDialog, ImageUploadField } from "@/components/kit";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { useCommonTranslation } from "@/lib/i18n/dictionaries/common";

// Banner CTA/action system (Phase C). A generic 'internal' destination is
// deliberately not offered here — CustomerApp has no multi-page routing for
// it to point at yet
// (see supabase/migrations/0019_banner_actions.sql for the full reasoning).
// Kept as a function (not a static array) now that labels are translated.
const bannerActionTypes = (t) => [
  { value: 'none', label: t('bannerActionNone') },
  { value: 'product', label: t('bannerActionProduct') },
  { value: 'category', label: t('bannerActionCategory') },
  { value: 'external', label: t('bannerActionExternal') },
  { value: 'phone', label: t('bannerActionPhone') },
];

// Theme Builder: restaurant picks its own primary/secondary colors
// (persisted on restaurants.theme_primary_color / theme_secondary_color and
// read by the customer-facing menu) + Banner sistemi (promo banners shown
// at the top of the customer menu).
export function DesignTab() {
  const { t } = useAdminTranslation();
  const { t: tc } = useCommonTranslation();
  const { restaurant, updateRestaurantDesign, banners, loadBanners, createBanner, updateBanner, deleteBanner, products, categories } = useAppStore();
  const bannersEnabled = useFeature(FEATURES.BANNERS);
  const confirmDialog = useConfirmDialog();

  // Formal capability layer (Master Plan Phase 6) — role-level check,
  // distinct from `bannersEnabled` above which is the plan/entitlement
  // check. A restaurant on a plan that grants banners can still have a
  // `staff` role viewing this (today no route lets that happen — DesignTab
  // only renders inside AdminApp, /admin-only — but gating by capability
  // rather than only by feature flag keeps the two axes independent, exactly
  // per capabilityService.js's own header comment on why these are separate
  // resolvers).
  const canCreateBanners = useCapability(CAPABILITIES.BANNERS_CREATE);
  const canEditBanners = useCapability(CAPABILITIES.BANNERS_EDIT);
  const canDeleteBanners = useCapability(CAPABILITIES.BANNERS_DELETE);

  const [primary, setPrimary] = useState(restaurant?.theme_primary_color || "#6C4CFF");
  const [secondary, setSecondary] = useState(restaurant?.theme_secondary_color || "#14151A");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const EMPTY_BANNER_FORM = { title: "", subtitle: "", image_url: "", link_url: "", action_type: "none", action_target_id: "" };
  const [bannerForm, setBannerForm] = useState(EMPTY_BANNER_FORM);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSaveError, setBannerSaveError] = useState(null);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  useEffect(() => {
    setPrimary(restaurant?.theme_primary_color || "#6C4CFF");
    setSecondary(restaurant?.theme_secondary_color || "#14151A");
  }, [restaurant?.theme_primary_color, restaurant?.theme_secondary_color]);

  const handleSaveTheme = async () => {
    setSaving(true);
    await updateRestaurantDesign({ themePrimaryColor: primary, themeSecondaryColor: secondary });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Create + edit share one form/handler, same pattern AdminApp's
  // ProductModal already uses — `editingBannerId` set means Save calls
  // updateBanner instead of createBanner, matching the values already
  // populated into bannerForm by handleEditBanner below.
  //
  // Fields are normalized per action_type before saving so a banner never
  // carries stale data from a type the admin switched away from (e.g.
  // action_target_id left over after switching product -> external).
  const handleSaveBanner = async (e) => {
    e.preventDefault();
    // A banner IS its image, so this one stays mandatory (the title/subtitle
    // are not). It used to `return` silently, which is indistinguishable from
    // a dead button when the browser's own `required` bubble doesn't fire —
    // e.g. after an upload failed and left the field empty.
    if (!bannerForm.image_url.trim()) {
      setBannerSaveError(t('bannerImageRequiredError'));
      return;
    }
    setBannerSaving(true);
    setBannerSaveError(null);

    const isTargetAction = bannerForm.action_type === 'product' || bannerForm.action_type === 'category';
    let linkUrl = isTargetAction ? '' : bannerForm.link_url.trim();
    // A phone number typed without a tel: prefix would otherwise open as a
    // (broken) relative link instead of the device dialer.
    if (bannerForm.action_type === 'phone' && linkUrl && !linkUrl.startsWith('tel:')) {
      linkUrl = `tel:${linkUrl.replace(/\s+/g, '')}`;
    }

    const payload = {
      title: bannerForm.title,
      subtitle: bannerForm.subtitle,
      image_url: bannerForm.image_url,
      link_url: linkUrl,
      action_type: bannerForm.action_type,
      action_target_id: isTargetAction && bannerForm.action_target_id ? bannerForm.action_target_id : null,
    };

    const { error } = editingBannerId
      ? await updateBanner({ id: editingBannerId, ...payload })
      : await createBanner({ ...payload, sort_order: banners.length, is_active: true });

    setBannerSaving(false);
    if (error) {
      setBannerSaveError(error.message || t('bannerSaveFailedError'));
      return;
    }

    setBannerForm(EMPTY_BANNER_FORM);
    setEditingBannerId(null);
  };

  const handleEditBanner = (b) => {
    setBannerSaveError(null);
    setEditingBannerId(b.id);
    setBannerForm({
      title: b.title || "",
      subtitle: b.subtitle || "",
      image_url: b.image_url || "",
      link_url: b.link_url || "",
      action_type: b.action_type || "none",
      action_target_id: b.action_target_id || "",
    });
  };

  const handleCancelEditBanner = () => {
    setBannerSaveError(null);
    setEditingBannerId(null);
    setBannerForm(EMPTY_BANNER_FORM);
  };

  const handleToggleBannerActive = (b) => {
    updateBanner({ id: b.id, is_active: !b.is_active });
  };

  const handleDeleteBanner = (b) => {
    confirmDialog.confirm({
      title: t('deleteBannerConfirmTitle'),
      message: t('deleteBannerConfirmMessage')(b.title || t('untitledBannerFallback')),
      onConfirm: () => deleteBanner(b.id),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('titleDesign')} description={t('designSubtitle')} />

      {/* Theme Builder */}
      <Card variant="plain">
        <CardHeader>
          <h2 className="font-semibold text-[var(--k-text)] flex items-center gap-2 text-sm">
            <Palette className="w-4 h-4 text-[var(--k-accent)]" />
            {t('themeBuilderTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--k-text-3)] mb-4">{t('themeBuilderDescription')}</p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Field label={t('primaryColorLabel')}>
              {(id) => (
                <div className="flex items-center gap-2">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} aria-label={t('primaryColorAriaLabel')} className="w-11 h-10 rounded-[var(--k-r-sm)] border border-[var(--k-border)] bg-[var(--k-surface-2)] cursor-pointer" />
                  <Input id={id} type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1" />
                </div>
              )}
            </Field>
            <Field label={t('secondaryColorLabel')}>
              {(id) => (
                <div className="flex items-center gap-2">
                  <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} aria-label={t('secondaryColorAriaLabel')} className="w-11 h-10 rounded-[var(--k-r-sm)] border border-[var(--k-border)] bg-[var(--k-surface-2)] cursor-pointer" />
                  <Input id={id} type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="flex-1" />
                </div>
              )}
            </Field>
          </div>
          <Button variant="primary" onClick={handleSaveTheme} disabled={saving} className="mt-4" icon={saved ? <CheckCircle2 className="w-4 h-4" /> : undefined}>
            {saving ? t('savingColors') : saved ? t('colorsSaved') : t('saveColorsButton')}
          </Button>
        </CardBody>
      </Card>

      {/* Banner system */}
      <Card variant="plain">
        <CardHeader>
          <h2 className="font-semibold text-[var(--k-text)] flex items-center gap-2 text-sm">
            <ImageIcon className="w-4 h-4 text-[var(--k-accent)]" />
            {t('bannerSystemTitle')}
          </h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--k-text-3)] mb-4">{t('bannerSystemDescription')}</p>

          {!bannersEnabled && (
            <Banner tone="warning" icon={<span className="w-2 h-2 rounded-full bg-[var(--k-warning)] shrink-0" />} className="mb-4 items-center">
              <p className="text-xs font-medium">{t('bannerFeatureDisabled')}</p>
            </Banner>
          )}

          {/* editingBannerId set -> Save calls updateBanner (banners.edit);
              unset -> createBanner (banners.create). Fieldset disables the
              whole form when either the plan-level feature or the role-level
              capability for the action currently in play is off. */}
          {bannerSaveError && (
            <Banner tone="danger" className="mb-4 text-sm">{bannerSaveError}</Banner>
          )}

          <fieldset disabled={!bannersEnabled || !(editingBannerId ? canEditBanners : canCreateBanners)} className="disabled:opacity-50">
          {/* Image first, and labelled: it is the ONLY mandatory part of a
              banner (a banner with no artwork has nothing to render), while
              title/subtitle are optional overlay copy. The previous order —
              two unlabelled text inputs above a bare URL box — read as
              "title is the main field", so an admin who filled only the
              title got a form that refused to submit with no explanation. */}
          <form onSubmit={handleSaveBanner} className="grid sm:grid-cols-2 gap-3 mb-5">
            <Field label={t('bannerImageFieldLabel')} required className="sm:col-span-2">
              {(id, a11y) => (
                <ImageUploadField
                  id={id}
                  value={bannerForm.image_url}
                  onChange={(url) => setBannerForm({ ...bannerForm, image_url: url })}
                  restaurantId={restaurant?.id} folder="banners"
                  allowVideo
                  urlPlaceholder={t('bannerImageUrlPlaceholder')}
                  uploadLabel={t('imageUploadButton')}
                  previewAlt={t('imagePreviewAlt')}
                  invalidLabel={t('logoInvalidBadge')}
                  {...a11y}
                />
              )}
            </Field>
            <Field label={t('bannerTitleFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} type="text" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder={t('bannerTitlePlaceholder')} {...a11y} />
              )}
            </Field>
            <Field label={t('bannerSubtitleFieldLabel')}>
              {(id, a11y) => (
                <Input id={id} type="text" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} placeholder={t('bannerSubtitlePlaceholder')} {...a11y} />
              )}
            </Field>

            <Field label={t('bannerActionFieldLabel')} className="sm:col-span-2">
              {(id) => (
                <Select
                  id={id}
                  value={bannerForm.action_type}
                  onChange={(e) => setBannerForm({ ...bannerForm, action_type: e.target.value, action_target_id: '', link_url: '' })}
                >
                  {bannerActionTypes(t).map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              )}
            </Field>

            {bannerForm.action_type === 'product' && (
              <Field label={t('whichProductLabel')} className="sm:col-span-2">
                {(id) => (
                  <Select id={id} value={bannerForm.action_target_id} onChange={(e) => setBannerForm({ ...bannerForm, action_target_id: e.target.value })} required>
                    <option value="">{t('selectProductOption')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            {bannerForm.action_type === 'category' && (
              <Field label={t('whichCategoryLabel')} className="sm:col-span-2">
                {(id) => (
                  <Select id={id} value={bannerForm.action_target_id} onChange={(e) => setBannerForm({ ...bannerForm, action_target_id: e.target.value })} required>
                    <option value="">{t('selectCategoryOption')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            {bannerForm.action_type === 'external' && (
              <Input type="text" value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} placeholder="https://..." className="sm:col-span-2" required />
            )}

            {bannerForm.action_type === 'phone' && (
              <Input type="tel" value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} placeholder="+994 XX XXX XX XX" className="sm:col-span-2" required />
            )}

            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="primary" disabled={bannerSaving} className="flex-1" icon={editingBannerId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                {editingBannerId ? t('saveChangesShort') : t('addBannerButton')}
              </Button>
              {editingBannerId && (
                <Button type="button" variant="secondary" onClick={handleCancelEditBanner} icon={<X className="w-4 h-4" />}>
                  {tc('cancel')}
                </Button>
              )}
            </div>
          </form>
          </fieldset>

          {banners.length === 0 ? (
            <EmptyState icon={<ImageIcon className="w-5 h-5" />} title={t('noBannersYet')} description={t('bannersNotFoundDescription')} />
          ) : (
            <div className="space-y-2">
              {banners.map((b) => (
                <div key={b.id} className={`flex items-center gap-3 bg-[var(--k-surface-2)] border rounded-[var(--k-r)] p-3 ${editingBannerId === b.id ? 'border-[var(--k-accent)]/60' : 'border-[var(--k-border)]'} ${b.is_active ? '' : 'opacity-60'}`}>
                  <div className="relative w-16 h-10 shrink-0">
                    {isVideoUrl(b.image_url) ? (
                      <video
                        src={b.image_url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-16 h-10 object-cover rounded-[var(--k-r-sm)] border border-[var(--k-border)]"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.image_url} alt={b.title || t('bannerAltFallback')} className="w-16 h-10 object-cover rounded-[var(--k-r-sm)] border border-[var(--k-border)]" />
                    )}
                    {/* Small badge so "this row is a video, not a static
                        image" is obvious at a glance in a list of tiny
                        autoplaying thumbnails. */}
                    {isVideoUrl(b.image_url) && (
                      <span className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white">
                        <Video className="w-2 h-2" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--k-text)] truncate">{b.title || t('untitledBannerInline')}</p>
                    {b.subtitle && <p className="text-xs text-[var(--k-text-3)] truncate">{b.subtitle}</p>}
                    {!b.is_active && <p className="text-[10px] font-medium text-[var(--k-warning)] uppercase tracking-wide mt-0.5">{t('bannerInactiveLabel')}</p>}
                  </div>
                  {/* Active toggle is an updateBanner() PATCH, same as edit —
                      gated on the same capability. */}
                  {canEditBanners && (
                    <Button
                      onClick={() => handleToggleBannerActive(b)}
                      variant="ghost"
                      size="icon"
                      aria-label={b.is_active ? t('deactivateBannerAriaLabel')(b.title || t('untitledBannerLower')) : t('activateBannerAriaLabel')(b.title || t('untitledBannerLower'))}
                      title={b.is_active ? t('bannerActiveTooltip') : t('bannerInactiveTooltip')}
                      className="shrink-0"
                    >
                      {b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                  )}
                  {canEditBanners && (
                    <Button
                      onClick={() => handleEditBanner(b)}
                      variant="ghost"
                      size="icon"
                      aria-label={t('editBannerAriaLabel')(b.title || t('untitledBannerLower'))}
                      className="shrink-0 hover:text-[var(--k-accent)]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                  {canDeleteBanners && (
                    <Button
                      onClick={() => handleDeleteBanner(b)}
                      variant="ghost"
                      size="icon"
                      aria-label={t('deleteBannerAriaLabel')(b.title || t('untitledBannerLower'))}
                      className="shrink-0 hover:text-[var(--k-danger)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
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

export default DesignTab;
