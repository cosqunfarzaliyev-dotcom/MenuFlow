"use client";

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Building2, Search, Users, Trash2, Edit2, Power, ExternalLink, Copy,
  X, Loader2, ChevronDown,
} from 'lucide-react';
import {
  createRestaurant, updateRestaurant, deleteRestaurant,
  markRestaurantActive, markRestaurantPastDue, extendRestaurantTrial, cancelRestaurantSubscription,
  fetchProfilesForRestaurant, assignUserToRestaurant, removeUserFromRestaurant,
} from '@/lib/services/superAdminService';
import { PLAN_ORDER, planMeta, subscriptionMeta, formatDate, daysUntil } from './constants';
import { useToast } from './Toast';

export function RestaurantsTab({ restaurants, stats, origin, refresh, openRestaurantId, onConsumeOpenId }) {
  const notify = useToast();
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [adminsModalRestaurant, setAdminsModalRestaurant] = useState(null);
  const [billingMenuId, setBillingMenuId] = useState(null);

  React.useEffect(() => {
    if (!openRestaurantId) return;
    const r = restaurants.find((x) => x.id === openRestaurantId);
    if (r) setEditingRestaurant(r);
    onConsumeOpenId?.();
  }, [openRestaurantId, restaurants, onConsumeOpenId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) =>
      r.name?.toLowerCase().includes(q) ||
      r.slug?.toLowerCase().includes(q) ||
      r.owner_email?.toLowerCase().includes(q)
    );
  }, [restaurants, query]);

  const handleBillingAction = async (r, action) => {
    setBillingMenuId(null);
    if (action === 'active') await markRestaurantActive(r.id);
    else if (action === 'past_due') await markRestaurantPastDue(r.id);
    else if (action === 'cancel') await cancelRestaurantSubscription(r.id);
    else if (action === 'extend') await extendRestaurantTrial(r.id, 14);
    notify('Abunəlik statusu yeniləndi.');
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ad, slug və ya owner email üzrə axtar…"
            className="w-full bg-slate-900/60 border border-slate-800 sa-radius-input pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="sa-btn flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shrink-0"
        >
          <Plus className="w-4 h-4" /> Yeni restoran
        </button>
      </div>

      <div className="sa-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="sa-caption text-slate-500">{query ? 'Nəticə tapılmadı.' : 'Hələ restoran yoxdur.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-left">
                  {['', 'Ad', 'Owner', 'Paket', 'Status', 'Bitmə tarixi', 'Sifariş sayı', ''].map((h, i) => (
                    <th key={i} className="sa-caption font-bold text-slate-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const rowStats = stats[r.id] || { orderCount: 0, revenue: 0 };
                  const plan = planMeta(r.plan);
                  const status = subscriptionMeta(r.subscription_status);
                  const trialDays = r.subscription_status === 'trialing' ? daysUntil(r.trial_ends_at) : null;
                  const menuUrl = origin ? `${origin}/menu/${r.slug}` : '';
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
                          {r.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-semibold whitespace-nowrap">{r.name}</p>
                        <p className="sa-caption text-slate-500">/{r.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.owner_email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold whitespace-nowrap" style={{ color: plan.color }}>{plan.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setBillingMenuId(billingMenuId === r.id ? null : r.id)}
                            className={`sa-caption font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap ${status.bg} ${status.text} ${status.border}`}
                          >
                            {status.label} <ChevronDown className="w-3 h-3" />
                          </button>
                          <AnimatePresence>
                            {billingMenuId === r.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute z-20 top-full left-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-2xl p-1.5 shadow-2xl"
                              >
                                {[
                                  { id: 'active', label: 'Aktiv et' },
                                  { id: 'past_due', label: 'Ödəniş gecikib et' },
                                  { id: 'extend', label: 'Trial uzat (+14 gün)' },
                                  { id: 'cancel', label: 'Ləğv et' },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => handleBillingAction(r, opt.id)}
                                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {r.subscription_status === 'trialing' && trialDays !== null
                          ? `${trialDays > 0 ? trialDays : 0} gün qalıb`
                          : formatDate(r.trial_ends_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-semibold whitespace-nowrap">{rowStats.orderCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {menuUrl && (
                            <>
                              <a href={menuUrl} target="_blank" rel="noreferrer" title="Menyuya bax"
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => { navigator.clipboard.writeText(menuUrl); notify('Link kopyalandı.'); }}
                                title="Linki kopyala"
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setAdminsModalRestaurant(r)}
                            title="Adminlər"
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingRestaurant(r)}
                            title="Redaktə et"
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => { await updateRestaurant({ id: r.id, is_active: !r.is_active }); notify(r.is_active ? 'Restoran deaktiv edildi.' : 'Restoran aktivləşdirildi.'); refresh(); }}
                            title={r.is_active ? 'Deaktiv et' : 'Aktivləşdir'}
                            className={`p-2 rounded-lg hover:bg-slate-800 ${r.is_active ? 'text-emerald-400' : 'text-slate-500'}`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`"${r.name}" restoranını silmək istədiyinizə əminsiniz? Bütün menyu, sifariş və masa məlumatları silinəcək.`)) return;
                              await deleteRestaurant(r.id);
                              notify('Restoran silindi.');
                              refresh();
                            }}
                            title="Sil"
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreateOpen && (
          <RestaurantModal
            title="Yeni restoran"
            onClose={() => setIsCreateOpen(false)}
            onSave={async (form) => {
              await createRestaurant(form);
              setIsCreateOpen(false);
              notify('Yeni restoran yaradıldı.');
              refresh();
            }}
          />
        )}
        {editingRestaurant && (
          <RestaurantModal
            title="Restoranı redaktə et"
            initial={editingRestaurant}
            isEdit
            onClose={() => setEditingRestaurant(null)}
            onSave={async (form) => {
              await updateRestaurant({ id: editingRestaurant.id, name: form.name, tagline: form.tagline, currencySymbol: form.currencySymbol, plan: form.plan });
              setEditingRestaurant(null);
              notify('Restoran yeniləndi.');
              refresh();
            }}
          />
        )}
        {adminsModalRestaurant && (
          <AdminsModal restaurant={adminsModalRestaurant} onClose={() => setAdminsModalRestaurant(null)} onChange={refresh} />
        )}
      </AnimatePresence>
    </div>
  );
}

const modalMotion = {
  overlay: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  panel: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

function RestaurantModal({ title, initial, isEdit, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    tagline: initial?.tagline || '',
    currencySymbol: initial?.currency_symbol || '₼',
    tableCount: initial?.table_count || 20,
    plan: initial?.plan && PLAN_ORDER.includes(initial.plan) ? initial.plan : 'free',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || (!isEdit && !form.slug.trim())) return;
    setSaving(true);
    await onSave({
      ...form,
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      tableCount: parseInt(form.tableCount, 10) || 20,
    });
    setSaving(false);
  };

  return (
    <motion.div {...modalMotion.overlay} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.form {...modalMotion.panel} onSubmit={handleSubmit} className="w-full max-w-md bg-slate-950 border border-slate-800 sa-radius-modal p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="sa-heading-4 text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div>
          <label className="sa-caption font-bold text-slate-400 mb-1 block">Restoran adı</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" required />
        </div>

        <div>
          <label className="sa-caption font-bold text-slate-400 mb-1 block">Slug (URL üçün, məs. acme-grill)</label>
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEdit}
            className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50" required />
          {isEdit && <p className="text-[10px] text-slate-500 mt-1">Slug yaradıldıqdan sonra dəyişdirilə bilməz (QR kodlar bu linkə bağlıdır).</p>}
        </div>

        <div>
          <label className="sa-caption font-bold text-slate-400 mb-1 block">Tagline</label>
          <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="sa-caption font-bold text-slate-400 mb-1 block">Valyuta simvolu</label>
            <input value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          {!isEdit ? (
            <div>
              <label className="sa-caption font-bold text-slate-400 mb-1 block">Masa sayı</label>
              <input type="number" min="1" max="200" value={form.tableCount} onChange={(e) => setForm({ ...form, tableCount: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          ) : (
            <div>
              <label className="sa-caption font-bold text-slate-400 mb-1 block">Paket</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 sa-radius-input px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {PLAN_ORDER.map((p) => <option key={p} value={p}>{planMeta(p).label}</option>)}
              </select>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="sa-btn w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Yadda saxla
        </button>
      </motion.form>
    </motion.div>
  );
}

function AdminsModal({ restaurant, onClose, onChange }) {
  const notify = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('restaurant_admin');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const data = await fetchProfilesForRestaurant(restaurant.id);
    setProfiles(data);
    setLoading(false);
  }, [restaurant.id]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSubmitting(true);
    setError('');
    const { error: err } = await assignUserToRestaurant({ email: newEmail.trim(), restaurantId: restaurant.id, role: newRole });
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Xəta baş verdi.');
      return;
    }
    setNewEmail('');
    notify('İstifadəçi restorana təyin edildi.');
    refresh();
    onChange?.();
  };

  return (
    <motion.div {...modalMotion.overlay} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div {...modalMotion.panel} className="w-full max-w-lg bg-slate-950 border border-slate-800 sa-radius-modal p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="sa-heading-4 text-white">{restaurant.name} — Adminlər</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <form onSubmit={handleAssign} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            placeholder="istifadəçi@email.com"
            className="flex-1 bg-slate-900 border border-slate-800 sa-radius-input px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
            className="bg-slate-900 border border-slate-800 sa-radius-input px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="restaurant_admin">Admin</option>
            <option value="staff">İşçi (staff)</option>
          </select>
          <button type="submit" disabled={submitting} className="sa-btn px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-bold whitespace-nowrap">
            {submitting ? '...' : 'Təyin et'}
          </button>
        </form>
        {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}
        <p className="text-[10px] text-slate-500">
          İstifadəçi əvvəlcə <span className="text-slate-300">/admin</span> və ya <span className="text-slate-300">/staff</span> səhifəsində hesab yaratmalıdır (email + şifrə), sonra burada email daxil edərək bu restorana təyin edin.
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-4">Yüklənir…</p>
          ) : profiles.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Bu restorana hələ admin təyin edilməyib.</p>
          ) : (
            profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-white text-sm font-semibold">{p.email}</p>
                  <p className="text-slate-500 text-[10px] font-bold uppercase">{p.role === 'restaurant_admin' ? 'Admin' : 'İşçi'}</p>
                </div>
                <button
                  onClick={async () => {
                    await removeUserFromRestaurant(p.id);
                    notify('İstifadəçi restorandan silindi.');
                    refresh();
                    onChange?.();
                  }}
                  className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RestaurantsTab;
