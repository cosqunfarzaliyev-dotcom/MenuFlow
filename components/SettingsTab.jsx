"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle2, Building2, Image as ImageIcon, DollarSign, Users2, Sparkles, RefreshCw } from "lucide-react";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { PageHeader, Card, CardBody, Field, Input, Button, Banner, ImageUploadField } from "@/components/kit";

const DEFAULT_SETTINGS = {
  restaurantName: "MenuFlow",
  restaurantLogo: "",
  currencySymbol: "₼",
  tableCount: 50,
  tagline: "Rəqəmsal QR Menyu və İdarəetmə Sistemi",
};

const CURRENCIES = ["₼", "$", "€", "₺", "₽", "£"];

const normalizeTableCount = (value) => {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 200 ? count : DEFAULT_SETTINGS.tableCount;
};

const createForm = (settings) => ({
  restaurantName: settings?.restaurantName?.trim() || DEFAULT_SETTINGS.restaurantName,
  restaurantLogo: settings?.restaurantLogo || DEFAULT_SETTINGS.restaurantLogo,
  currencySymbol: settings?.currencySymbol?.trim() || DEFAULT_SETTINGS.currencySymbol,
  tableCount: normalizeTableCount(settings?.tableCount),
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
      currencySymbol: values.currencySymbol.trim() || DEFAULT_SETTINGS.currencySymbol,
      tableCount: normalizeTableCount(values.tableCount),
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

  const handleResetDefaults = useCallback(() => {
    setForm(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const nameFieldLabel = <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('restaurantNameLabel')}</span>;
  const logoFieldLabel = <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('logoUrlLabel')}</span>;
  const currencyFieldLabel = <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('currencySymbolLabel')}</span>;
  const tableCountFieldLabel = <span className="flex items-center gap-1.5"><Users2 className="w-3.5 h-3.5 text-[var(--k-accent)]" />{t('tableCountLabel')}</span>;
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

            <Field label={logoFieldLabel} hint={!form.restaurantLogo.trim() ? t('logoEmptyHint') : undefined}>
              {(id, a11y) => (
                <ImageUploadField
                  id={id} value={form.restaurantLogo}
                  onChange={(url) => updateForm("restaurantLogo", url)}
                  restaurantId={restaurantId} folder="logo"
                  urlPlaceholder={t('logoUrlPlaceholder')}
                  uploadLabel={t('imageUploadButton')}
                  previewAlt={t('logoPreviewAlt')}
                  invalidLabel={t('logoInvalidBadge')}
                  {...a11y}
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

            <Field label={tableCountFieldLabel} hint={t('tableCountHint')} required>
              {(id, a11y) => (
                <Input
                  id={id} type="number" min="1" max="200" value={form.tableCount}
                  onChange={(event) => updateForm("tableCount", normalizeTableCount(event.target.value))}
                  className="font-medium" {...a11y}
                />
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
    currencySymbol: PropTypes.string,
    tableCount: PropTypes.number,
    tagline: PropTypes.string,
  }),
  updateRestaurantProfile: PropTypes.func.isRequired,
  restaurantId: PropTypes.string,
};

SettingsTab.defaultProps = { settings: undefined, restaurantId: undefined };
