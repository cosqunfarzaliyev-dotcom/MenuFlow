"use client";

import React, { useEffect, useState } from "react";
import { Palette, Image as ImageIcon, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

// Theme Builder: restaurant picks its own primary/secondary colors
// (persisted on restaurants.theme_primary_color / theme_secondary_color and
// read by the customer-facing menu) + Banner sistemi (promo banners shown
// at the top of the customer menu).
export function DesignTab() {
  const { restaurant, updateRestaurantDesign, banners, loadBanners, createBanner, deleteBanner } = useAppStore();

  const [primary, setPrimary] = useState(restaurant?.theme_primary_color || "#6C4CFF");
  const [secondary, setSecondary] = useState(restaurant?.theme_secondary_color || "#14151A");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [bannerForm, setBannerForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "" });
  const [bannerSaving, setBannerSaving] = useState(false);

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

  const handleAddBanner = async (e) => {
    e.preventDefault();
    if (!bannerForm.image_url.trim()) return;
    setBannerSaving(true);
    await createBanner({ ...bannerForm, sort_order: banners.length, is_active: true });
    setBannerForm({ title: "", subtitle: "", image_url: "", link_url: "" });
    setBannerSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Theme Builder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-lg text-white">Theme Builder — Rənglər</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">Restoranın əsas və ikinci rəngini seçin. Bu rənglər müştəri menyusunda tətbiq olunur.</p>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">Əsas rəng</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-12 h-11 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer" />
              <input type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-1">İkinci rəng</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-12 h-11 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer" />
              <input type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveTheme}
          disabled={saving}
          className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : null}
          {saving ? "Yadda saxlanılır..." : saved ? "Yadda saxlanıldı" : "Rəngləri yadda saxla"}
        </button>
      </div>

      {/* Banner system */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-lg text-white">Banner Sistemi</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">Müştəri menyusunun yuxarısında göstərilən kampaniya bannerləri.</p>

        <form onSubmit={handleAddBanner} className="grid sm:grid-cols-2 gap-3 mb-5">
          <input type="text" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder="Başlıq (istəyə bağlı)" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input type="text" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} placeholder="Alt başlıq (istəyə bağlı)" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input type="text" value={bannerForm.image_url} onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })} placeholder="Şəkil URL (məcburi)" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input type="text" value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} placeholder="Keçid linki (istəyə bağlı)" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <button type="submit" disabled={bannerSaving} className="sm:col-span-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Banner əlavə et
          </button>
        </form>

        <div className="space-y-2">
          {banners.length === 0 && <p className="text-sm text-slate-500">Hələ banner əlavə edilməyib.</p>}
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt={b.title || "banner"} className="w-16 h-10 object-cover rounded-lg border border-slate-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{b.title || "(başlıqsız)"}</p>
                {b.subtitle && <p className="text-xs text-slate-500 truncate">{b.subtitle}</p>}
              </div>
              <button onClick={() => deleteBanner(b.id)} className="text-slate-500 hover:text-rose-400 p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DesignTab;
