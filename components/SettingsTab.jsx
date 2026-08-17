"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import { CheckCircle2, Building2, Image as ImageIcon, DollarSign, Users2, Sparkles, RefreshCw } from "lucide-react";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { PageHeader, Card, CardBody, Field, Input, Button, Tag, Banner } from "@/components/kit";

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

export function SettingsTab({ settings, updateSettings }) {
  const { t } = useAdminTranslation();
  const [form, setForm] = useState(() => createForm(settings));
  const [savedMessage, setSavedMessage] = useState(false);
  const [isLogoValid, setIsLogoValid] = useState(true);
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

  const handleLogoChange = useCallback((event) => {
    setIsLogoValid(true);
    updateForm("restaurantLogo", event.target.value);
  }, [updateForm]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    updateSettings({
      restaurantName: form.restaurantName.trim() || DEFAULT_SETTINGS.restaurantName,
      restaurantLogo: form.restaurantLogo.trim(),
      currencySymbol: form.currencySymbol.trim() || DEFAULT_SETTINGS.currencySymbol,
      tableCount: normalizeTableCount(form.tableCount),
      tagline: form.tagline.trim(),
    });
    showSavedMessage();
  }, [form, showSavedMessage, updateSettings]);

  const handleResetDefaults = useCallback(() => {
    setForm(DEFAULT_SETTINGS);
    setIsLogoValid(true);
    updateSettings(DEFAULT_SETTINGS);
    showSavedMessage();
  }, [showSavedMessage, updateSettings]);

  const hasLogo = Boolean(form.restaurantLogo.trim());
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
          <Button type="button" variant="secondary" size="sm" onClick={handleResetDefaults} title={t('resetToDefaultsTitle')} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">{t('resetButton')}</span>
          </Button>
        }
      />

      {savedMessage && (
        <Banner tone="success" icon={<CheckCircle2 className="w-4 h-4 shrink-0" />} className="font-medium">
          {t('settingsSavedMessage')}
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

            <Field label={logoFieldLabel} hint={!hasLogo ? t('logoEmptyHint') : undefined}>
              {(id, a11y) => (
                <>
                  <Input
                    id={id} type="text" value={form.restaurantLogo}
                    onChange={handleLogoChange} placeholder={t('logoUrlPlaceholder')} {...a11y}
                  />
                  {hasLogo && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-[var(--k-surface-2)] border border-[var(--k-border)] rounded-[var(--k-r)]">
                      <span className="text-xs font-medium text-[var(--k-text-3)]">{t('logoPreviewLabel')}</span>
                      {isLogoValid ? (
                        <Image key={form.restaurantLogo} src={form.restaurantLogo.trim()} alt={t('logoPreviewAlt')} className="w-10 h-10 object-contain rounded-[var(--k-r-sm)] border border-[var(--k-border)] bg-[var(--k-surface-3)]" width={40} height={40} unoptimized onError={() => setIsLogoValid(false)} />
                      ) : (
                        <Tag tone="danger">{t('logoInvalidBadge')}</Tag>
                      )}
                    </div>
                  )}
                </>
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
              <Button type="submit" variant="primary" size="block" icon={<CheckCircle2 className="w-4 h-4" />}>
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
  updateSettings: PropTypes.func.isRequired,
};

SettingsTab.defaultProps = { settings: undefined };
