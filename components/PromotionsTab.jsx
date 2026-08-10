"use client";

import React, { useEffect, useState } from "react";
import { Megaphone, Percent, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

const emptyCampaign = { title: "", description: "", banner_image_url: "" };
const emptyDiscount = { title: "", discount_type: "percentage", value: "", product_id: "" };

// Admin -> Kampaniya + Endirim: kampaniyalar (bannerli tanıtımlar) və
// endirimlər (bütün menyuya və ya seçilmiş məhsula tətbiq olunan qiymət
// azalması) buradan idarə olunur.
export function PromotionsTab() {
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
      {/* Campaigns */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-lg text-white">Kampaniyalar</h2>
        </div>
        <form onSubmit={handleAddCampaign} className="grid sm:grid-cols-3 gap-3 mb-5">
          <input type="text" value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} placeholder="Kampaniya adı" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input type="text" value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} placeholder="Qısa açıqlama" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input type="text" value={campaignForm.banner_image_url} onChange={(e) => setCampaignForm({ ...campaignForm, banner_image_url: e.target.value })} placeholder="Banner şəkil URL (istəyə bağlı)" className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <button type="submit" className="sm:col-span-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Kampaniya əlavə et
          </button>
        </form>
        <div className="space-y-2">
          {campaigns.length === 0 && <p className="text-sm text-slate-500">Hələ kampaniya yoxdur.</p>}
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{c.title}</p>
                {c.description && <p className="text-xs text-slate-500 truncate">{c.description}</p>}
              </div>
              <button onClick={() => deleteCampaign(c.id)} className="text-slate-500 hover:text-rose-400 p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Discounts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-lg text-white">Endirimlər</h2>
        </div>
        <form onSubmit={handleAddDiscount} className="grid sm:grid-cols-4 gap-3 mb-5">
          <input type="text" value={discountForm.title} onChange={(e) => setDiscountForm({ ...discountForm, title: e.target.value })} placeholder="Endirim adı" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <select value={discountForm.discount_type} onChange={(e) => setDiscountForm({ ...discountForm, discount_type: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="percentage">Faiz (%)</option>
            <option value="fixed">Sabit məbləğ (₼)</option>
          </select>
          <input type="number" step="0.01" min="0" value={discountForm.value} onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })} placeholder="Dəyər" required className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          <select value={discountForm.product_id} onChange={(e) => setDiscountForm({ ...discountForm, product_id: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">Bütün menyu</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className="sm:col-span-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Endirim əlavə et
          </button>
        </form>
        <div className="space-y-2">
          {discounts.length === 0 && <p className="text-sm text-slate-500">Hələ endirim yoxdur.</p>}
          {discounts.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {d.title} — {d.discount_type === 'percentage' ? `${d.value}%` : `${d.value} ₼`}
                </p>
                <p className="text-xs text-slate-500 truncate">{d.product_id ? (productName(d.product_id) || 'Məhsul') : 'Bütün menyuya tətbiq olunur'}</p>
              </div>
              <button onClick={() => deleteDiscount(d.id)} className="text-slate-500 hover:text-rose-400 p-2 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PromotionsTab;
