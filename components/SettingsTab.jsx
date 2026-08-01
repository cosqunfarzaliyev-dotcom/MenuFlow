"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import PropTypes from "prop-types";
import { Settings, CheckCircle2, Building2, Image as ImageIcon, DollarSign, Users2, Sparkles, RefreshCw } from "lucide-react";

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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h4 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              Restoran Tənzimləmələri (Branding)
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Bütün məlumatlar brauzerin <code className="text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">localStorage</code> yaddaşında saxlanılır. Başqa restorana verildikdə 1 dəqiqəyə bütün brendinqi dəyişə bilərsiniz.
            </p>
          </div>
          <button type="button" onClick={handleResetDefaults} title="İlkin tənzimləmələrə sıfırla" className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sıfırla</span>
          </button>
        </div>

        {savedMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Tənzimləmələr uğurla yadda saxlanıldı! Bütün tətbiq dərhal yeniləndi.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-400" />
              Restoranın Adı
            </label>
            <input type="text" value={form.restaurantName} onChange={(event) => updateForm("restaurantName", event.target.value)} placeholder="Məsələn: Mangal Steak House, MenuFlow" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" required />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              Logo Şəklinin Keçidi (URL)
            </label>
            <input type="text" value={form.restaurantLogo} onChange={handleLogoChange} placeholder="https://images.unsplash.com/... və ya şəkil linki" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
            {hasLogo ? (
              <div className="mt-3 flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs font-semibold text-slate-400">Logo Önbaxış:</span>
                {isLogoValid && <Image key={form.restaurantLogo} src={form.restaurantLogo.trim()} alt="Logo Önbaxış" className="w-10 h-10 object-contain rounded-lg border border-slate-800 bg-slate-900" width={40} height={40} unoptimized onError={() => setIsLogoValid(false)} />}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">Boş saxlasanız, susmaya görə QR menyu ikonu göstəriləcək.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-blue-400" />
              Valyuta Simvolu
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {CURRENCIES.map((currency) => (
                <button type="button" key={currency} onClick={() => updateForm("currencySymbol", currency)} className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${form.currencySymbol === currency ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"}`}>
                  {currency}
                </button>
              ))}
              <input type="text" value={form.currencySymbol} onChange={(event) => updateForm("currencySymbol", event.target.value)} placeholder="Digər..." className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white text-center font-bold focus:outline-none focus:border-blue-500" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Bütün menyudakı qiymətlər, səbət və hesab qəbzləri bu valyuta ilə göstəriləcək.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-blue-400" />
              Masa Sayı (QR Kodlar Avtomatik Yenilənir)
            </label>
            <input type="number" min="1" max="200" value={form.tableCount} onChange={(event) => updateForm("tableCount", normalizeTableCount(event.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-bold" required />
            <p className="text-[11px] text-slate-500 mt-1">Masa sayını dəyişdikdə &quot;QR Kodlar&quot; bölməsində avtomatik həmin sayda masalar və onların çap QR kodları yenilənəcək.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Şüar / Slogan (Tagline)
            </label>
            <input type="text" value={form.tagline} onChange={(event) => updateForm("tagline", event.target.value)} placeholder="Rəqəmsal QR Menyu və İdarəetmə Sistemi" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          <div className="pt-2">
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/30 text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Dəyişiklikləri Yadda Saxla</span>
            </button>
          </div>
        </form>
      </div>
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
