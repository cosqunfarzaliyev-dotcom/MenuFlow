"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import { CheckCircle2, Building2, Image as ImageIcon, DollarSign, Users2, Sparkles, RefreshCw } from "lucide-react";
import { useAdminTranslation } from "@/lib/i18n/dictionaries/admin";
import { PageHeader, Card, CardBody, Field, Input, Button, Badge, Alert } from "@/components/ui";

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
  const nameFieldLabel = <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-blue-400" />{t('restaurantNameLabel')}</span>;
  const logoFieldLabel = <span className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-blue-400" />{t('logoUrlLabel')}</span>;
  const currencyFieldLabel = <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-blue-400" />{t('currencySymbolLabel')}</span>;
  const tableCountFieldLabel = <span className="flex items-center gap-1.5"><Users2 className="w-4 h-4 text-blue-400" />{t('tableCountLabel')}</span>;
  const taglineFieldLabel = <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-blue-400" />{t('taglineLabel')}</span>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <PageHeader
        context="dark"
        title={t('titleSettings')}
        description={t('settingsDescription')}
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={handleResetDefaults} title={t('resetToDefaultsTitle')}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('resetButton')}</span>
          </Button>
        }
      />

      {savedMessage && (
        <Alert tone="success" icon={<CheckCircle2 className="w-4 h-4 shrink-0" />} className="font-bold">
          {t('settingsSavedMessage')}
        </Alert>
      )}

      <Card context="dark" variant="flat">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field context="dark" label={nameFieldLabel} required>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={form.restaurantName}
                  onChange={(event) => updateForm("restaurantName", event.target.value)}
                  placeholder={t('restaurantNamePlaceholder')} {...a11y}
                />
              )}
            </Field>

            <Field context="dark" label={logoFieldLabel} hint={!hasLogo ? t('logoEmptyHint') : undefined}>
              {(id, a11y) => (
                <>
                  <Input
                    context="dark" id={id} type="text" value={form.restaurantLogo}
                    onChange={handleLogoChange} placeholder={t('logoUrlPlaceholder')} {...a11y}
                  />
                  {hasLogo && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-xs font-semibold text-slate-400">{t('logoPreviewLabel')}</span>
                      {isLogoValid ? (
                        <Image key={form.restaurantLogo} src={form.restaurantLogo.trim()} alt={t('logoPreviewAlt')} className="w-10 h-10 object-contain rounded-lg border border-slate-800 bg-slate-900" width={40} height={40} unoptimized onError={() => setIsLogoValid(false)} />
                      ) : (
                        <Badge tone="danger">{t('logoInvalidBadge')}</Badge>
                      )}
                    </div>
                  )}
                </>
              )}
            </Field>

            <Field context="dark" label={currencyFieldLabel} hint={t('currencyHint')}>
              {(id, a11y) => (
                <div className="flex flex-wrap items-center gap-2">
                  {CURRENCIES.map((currency) => (
                    <button type="button" key={currency} onClick={() => updateForm("currencySymbol", currency)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${form.currencySymbol === currency ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"}`}>
                      {currency}
                    </button>
                  ))}
                  <Input
                    context="dark" id={id} type="text" value={form.currencySymbol}
                    onChange={(event) => updateForm("currencySymbol", event.target.value)}
                    placeholder={t('currencyOtherPlaceholder')} className="w-24 text-center" {...a11y}
                  />
                </div>
              )}
            </Field>

            <Field context="dark" label={tableCountFieldLabel} hint={t('tableCountHint')} required>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="number" min="1" max="200" value={form.tableCount}
                  onChange={(event) => updateForm("tableCount", normalizeTableCount(event.target.value))}
                  className="font-bold" {...a11y}
                />
              )}
            </Field>

            <Field context="dark" label={taglineFieldLabel}>
              {(id, a11y) => (
                <Input
                  context="dark" id={id} type="text" value={form.tagline}
                  onChange={(event) => updateForm("tagline", event.target.value)}
                  placeholder={t('taglinePlaceholderDefault')} {...a11y}
                />
              )}
            </Field>

            <div className="pt-2">
              <Button type="submit" size="block">
                <CheckCircle2 className="w-4 h-4" />
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
