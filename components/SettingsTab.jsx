"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle2, Building2, Image as ImageIcon, DollarSign, Sparkles, RefreshCw } from "lucide-react";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { PageHeader, Card, CardBody, Field, Input, Button, Banner, ImageUploadField, Switch } from "@/components/kit";

const DEFAULT_SETTINGS = {
  restaurantName: "MenuFlow",
  restaurantLogo: "",
  logoDisplayMode: "name",
  currencySymbol: "₼",
  tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
};

const CURRENCIES = ["₼", "$", "€", "₺", "₽", "£"];

// Masa sayı bilərəkdən burada yoxdur — restaurant_tables sətirləri yalnız
// restoran yaradılanda (superAdminService.js -> createDefaultTablesForRestaurant)
// generasiya olunur, sonradan heç bir yerdə (bu forma daxil) sinxronlaşmır.
// Admin bu ədədi dəyişəndə əvvəllər `restaurants.table_count` yazılırdı, amma
// heç bir real masa sətri əlavə/silinmirdi — görünüşdə işləyən, əslində
// pozulmuş bir sahə idi. Masa sayı yalnız SuperAdmin-in restoran yaratma
// axınında təyin olunur (components/superadmin/RestaurantsTab.jsx).
const createForm = (settings) => ({
  restaurantName: settings?.restaurantName?.trim() || DEFAULT_SETTINGS.restaurantName,
  restaurantLogo: settings?.restaurantLogo || DEFAULT_SETTINGS.restaurantLogo,
  logoDisplayMode: settings?.logoDisplayMode || DEFAULT_SETTINGS.logoDisplayMode,
  currencySymbol: settings?.currencySymbol?.trim() || DEFAULT_SETTINGS.currencySymbol,
  tagline: settings?.tagline || DEFAULT_SETTINGS.tagline,
});

// `settings` (the display prop) is already correctly derived from the real
// `restaurants` row by AdminApp.jsx whenever one is loaded — this form's
// SAVE path used to go through updateSettings(), a purely local Zustand
// merge that never reached Supabase at all (`restaurants.name/logo/
// currency_symbol/table_count/tagline` were never written). Every field
// below is a real, already-whitelisted column on updateRestaurant()
// (lib/services/superAdminService.js), so the fix is routing every field
// through updateRestaurantProfile (lib/store.js) instead — not just logo.
export function SettingsTab({ settings, updateRestaurantProfile, restaurantId }) {
  const { t } = useAdminTranslation();
  const [form, setForm] = useState(() => createForm(settings));
  const [savedMessage, setSavedMessage] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const messageTimeoutRef = useRef(null);

  const showSavedMessage = useCallback(() => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setSavedMessage(true);
    messageTimeoutRef.current = window.setTimeout(() => {
      setSavedMessage(false);
      messageTimeoutRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
  }, []);

  const updateForm = useCallback((field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }, []);

  const persist = useCallback(async (values) => {
    setSaving(true);
    setSaveError(null);
    const { error } = await updateRestaurantProfile({
      name: values.restaurantName.trim() || DEFAULT_SETTINGS.restaurantName,
      logo: values.restaurantLogo.trim(),
      // No logo → force back to 'name' regardless of what the switch was
      // left on, so a cleared logo can never leave the customer header
      // pointed at an empty image src.
      logoDisplayMode: values.restaurantLogo.trim() ? values.logoDisplayMode : 'name',
      currencySymbol: values.currencySymbol.trim() || DEFAULT_SETTINGS.currencySymbol,
      tagline: values.tagline.trim(),
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message || t('settingsSaveErrorMessage'));
      return false;
    }
    showSavedMessage();
    return true;
  }, [updateRestaurantProfile, showSavedMessage, t]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    persist(form);
  }, [form, persist]);

  // Logo + its display mode save immediately, independent of the rest of
  // this form's "Yadda saxla" button — an uploaded file used to only ever
  // land in `form.restaurantLogo` (local state), never Supabase, unless the
  // admin ALSO clicked Save afterwards. Nothing here told them that second
  // step was still needed, so an upload routinely never made it to the DB
  // at all — confirmed live (restaurants.logo was still '' after repeated
  // "I uploaded it" reports). Auto-saving on upload completion removes that
  // failure mode outright instead of just explaining it better.
  const [autoSaving, setAutoSaving] = useState(false);
  const persistLogoFields = useCallback(async (logo, logoDisplayMode) => {
    setAutoSaving(true);
    setSaveError(null);
    const { error } = await updateRestaurantProfile({
      logo: logo.trim(),
      logoDisplayMode: logo.trim() ? logoDisplayMode : 'name',
    });
    setAutoSaving(false);
    if (error) {
      setSaveError(error.message || t('settingsSaveErrorMessage'));
      return;
    }
    showSavedMessage();
  }, [updateRestaurantProfile, showSavedMessage, t]);

  const handleResetDefaults = useCallback(() => {
    setForm(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const nameFieldLabel = <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('restaurantNameLabel')}</span>;
  const logoFieldLabel = <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('logoUrlLabel')}</span>;
  const currencyFieldLabel = <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('currencySymbolLabel')}</span>;
  const taglineFieldLabel = <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('taglineLabel')}</span>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <PageHeader
        title={t('titleSettings')}
        description={t('settingsDescription')}
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={handleResetDefaults} loading={saving} title={t('resetToDefaultsTitle')} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">{t('resetButton')}</span>
          </Button>
        }
      />

      {savedMessage && (
        <Banner tone="success" icon={<CheckCircle2 className="w-4 h-4 shrink-0" />} className="font-medium">
          {t('settingsSavedMessage')}
        </Banner>
      )}
      {saveError && (
        <Banner tone="danger" className="font-medium">
          {saveError}
        </Banner>
      )}

      <Card variant="plain">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label={nameFieldLabel} required>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={form.restaurantName}
                  onChange={(event) => updateForm("restaurantName", event.target.value)}
                  placeholder={t('restaurantNamePlaceholder')} {...a11y}
                />
              )}
            </Field>

            <Field label={logoFieldLabel} hint={!form.restaurantLogo.trim() ? t('logoEmptyHint') : t('logoAutoSavedHint')}>
              {(id, a11y) => (
                <ImageUploadField
                  id={id} value={form.restaurantLogo}
                  onChange={(url) => updateForm("restaurantLogo", url)}
                  onUploadComplete={(url) => persistLogoFields(url, form.logoDisplayMode)}
                  restaurantId={restaurantId} folder="logo"
                  urlPlaceholder={t('logoUrlPlaceholder')}
                  uploadLabel={t('imageUploadButton')}
                  previewAlt={t('logoPreviewAlt')}
                  invalidLabel={t('logoInvalidBadge')}
                  {...a11y}
                />
              )}
            </Field>

            {/* 0035_restaurant_logo_display_mode.sql — lets the customer
                menu header show the full, uncropped logo instead of the
                restaurant name. Disabled without a logo uploaded: "show
                full logo" is meaningless with nothing to show, and leaving
                it live-but-inert here would just read as broken. Saves
                immediately on toggle (persistLogoFields), same reasoning
                as the upload above — this pairs with it, so it shouldn't
                need a separate trip through the page's own Save button
                either. */}
            <Field label={t('logoDisplayModeLabel')}>
              {() => (
                <Switch
                  checked={form.logoDisplayMode === 'logo'}
                  disabled={!form.restaurantLogo.trim() || autoSaving}
                  onChange={(checked) => {
                    const mode = checked ? 'logo' : 'name';
                    updateForm("logoDisplayMode", mode);
                    persistLogoFields(form.restaurantLogo, mode);
                  }}
                  description={!form.restaurantLogo.trim() ? t('logoDisplayModeDisabledHint') : t('logoDisplayModeHint')}
                />
              )}
            </Field>

            <Field label={currencyFieldLabel} hint={t('currencyHint')}>
              {(id, a11y) => (
                <div className="flex flex-wrap items-center gap-2">
                  {CURRENCIES.map((currency) => (
                    <button type="button" key={currency} onClick={() => updateForm("currencySymbol", currency)} className={`px-3.5 py-2 rounded-[var(--k-r)] text-xs font-medium border transition-colors ${form.currencySymbol === currency ? "bg-[var(--k-accent)] text-[var(--k-accent-fg)] border-[var(--k-accent)]" : "bg-[var(--k-surface-2)] text-[var(--k-text-3)] border-[var(--k-border)] hover:text-[var(--k-text)] hover:border-[var(--k-border-2)]"}`}>
                      {currency}
                    </button>
                  ))}
                  <Input
                    id={id} type="text" value={form.currencySymbol}
                    onChange={(event) => updateForm("currencySymbol", event.target.value)}
                    placeholder={t('currencyOtherPlaceholder')} className="w-24 text-center" {...a11y}
                  />
                </div>
              )}
            </Field>

            {/* Read-only: masa sayı yalnız SuperAdmin tərəfindən (restoran
                yaradılanda) təyin olunur, burada dəyişdirilə bilməz — dəyəri
                dəyişmək əvvəllər real restaurant_tables sətirlərini
                əlavə/silmirdi, sadəcə göstərici ədədi yazırdı. */}
            <Field label={t('tableCountLabel')} hint={t('tableCountHint')}>
              {(id) => (
                <Input id={id} type="number" value={settings?.tableCount ?? ''} disabled className="font-medium" />
              )}
            </Field>

            <Field label={taglineFieldLabel}>
              {(id, a11y) => (
                <Input
                  id={id} type="text" value={form.tagline}
                  onChange={(event) => updateForm("tagline", event.target.value)}
                  placeholder={t('taglinePlaceholderDefault')} {...a11y}
                />
              )}
            </Field>

            <div className="pt-2">
              <Button type="submit" variant="primary" size="block" loading={saving} icon={<CheckCircle2 className="w-4 h-4" />}>
                <span>{t('saveChangesButton')}</span>
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

SettingsTab.propTypes = {
  settings: PropTypes.shape({
    restaurantName: PropTypes.string,
    restaurantLogo: PropTypes.string,
    logoDisplayMode: PropTypes.string,
    currencySymbol: PropTypes.string,
    tableCount: PropTypes.number,
    tagline: PropTypes.string,
  }),
  updateRestaurantProfile: PropTypes.func.isRequired,
  restaurantId: PropTypes.string,
};

SettingsTab.defaultProps = { settings: undefined, restaurantId: undefined };
