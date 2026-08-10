"use client";

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Building2, Search, Users, Trash2, Edit2, ExternalLink, Copy,
  X, Loader2,
} from 'lucide-react';
import {
  createRestaurant, updateRestaurant, deleteRestaurant,
  markRestaurantActive, markRestaurantPastDue, cancelRestaurantSubscription,
  extendRestaurantTrial, setRestaurantActiveState, setRestaurantFeatureFlag, setRestaurantPlan,
  fetchProfilesForRestaurant, assignUserToRestaurant, removeUserFromRestaurant,
} from '@/lib/services/superAdminService';
import { TRIAL_LENGTH_DAYS } from '@/lib/services/billingService';
import { PLAN_ORDER, planMeta, subscriptionMeta, formatDate, daysUntil, FEATURE_FLAG_META, featureFlags } from './constants';
import { useToast } from './Toast';

// Small labeled on/off switch used throughout the restaurant controls panel.
// `pending` disables it mid-request so a slow network can't produce a
// double-toggle, and `onChange` is expected to return a promise that
// resolves to a truthy/falsy success so the caller can show a real error
// toast instead of always claiming success (the bug the switches replace).
function Switch({ label, description, checked, pending, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-white text-sm font-semibold">{label}</p>
        {description && <p className="sa-caption text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export function RestaurantsTab({ restaurants, stats, origin, refresh, openRestaurantId, onConsumeOpenId }) {
  const notify = useToast();
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [adminsModalRestaurant, setAdminsModalRestaurant] = useState(null);

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
                        <div className="flex items-center gap-1.5">
                          <span className={`sa-caption font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${status.bg} ${status.text} ${status.border}`}>
                            {status.label}
                          </span>
                          {r.is_active === false && (
                            <span className="sa-caption font-bold px-2.5 py-1 rounded-full border bg-slate-800 text-slate-400 border-slate-700 whitespace-nowrap">
                              Deaktiv
                            </span>
                          )}
                        </div>
                        <p className="sa-caption text-slate-600 mt-1">Redaktədən dəyiş →</p>
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
                            onClick={async () => {
                              if (!window.confirm(`"${r.name}" restoranını silmək istədiyinizə əminsiniz? Bütün menyu, sifariş və masa məlumatları silinəcək.`)) return;
                              const { error } = await deleteRestaurant(r.id);
                              if (error) { notify(error.message || 'Silinmədi, yenidən cəhd edin.', 'error'); return; }
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
              const { error } = await createRestaurant(form);
              if (error) { notify(error.message || 'Yaradılmadı, yenidən cəhd edin.', 'error'); return; }
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
            onRefresh={refresh}
            onSave={async (form) => {
              const planChanged = form.plan !== editingRestaurant.plan;
              const { error } = planChanged
                ? await setRestaurantPlan(editingRestaurant.id, form.plan)
                : { error: null };
              const { error: err2 } = await updateRestaurant({
                id: editingRestaurant.id, name: form.name, tagline: form.tagline, currencySymbol: form.currencySymbol,
              });
              if (error || err2) {
                notify((error || err2).message || 'Yadda saxlanmadı, yenidən cəhd edin.', 'error');
                return;
              }
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

function RestaurantModal({ title, initial, isEdit, onClose, onSave, onRefresh }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    tagline: initial?.tagline || '',
    currencySymbol: initial?.currency_symbol || '₼',
    tableCount: initial?.table_count || 20,
    plan: initial?.plan && PLAN_ORDER.includes(initial.plan) ? initial.plan : 'basic',
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
        {isEdit && <p className="text-[10px] text-slate-500 -mt-2">Paket dəyişəndə Apple/Google Pay və Banner switch-ləri həmin paketin default vəziyyətinə sıfırlanır (aşağıda əl ilə yenidən dəyişə bilərsiniz).</p>}

        <button type="submit" disabled={saving} className="sa-btn w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Yadda saxla
        </button>

        {isEdit && initial && <RestaurantControlsPanel restaurant={initial} onRefresh={onRefresh} />}
      </motion.form>
    </motion.div>
  );
}

// Instant-apply switches for a restaurant's access/billing/feature state.
// Each switch calls its service function immediately (not tied to the
// surrounding form's "Yadda saxla" button) and shows a real success/error
// toast — the earlier version of this panel always said "uğurlu" even when
// the underlying update failed, which is why the Aktiv/Deaktiv control used
// to look broken.
function RestaurantControlsPanel({ restaurant, onRefresh }) {
  const notify = useToast();
  const [local, setLocal] = useState(restaurant);
  const [pendingKey, setPendingKey] = useState(null);

  React.useEffect(() => { setLocal(restaurant); }, [restaurant]);

  const run = async (key, action, optimisticPatch) => {
    setPendingKey(key);
    setLocal((prev) => ({ ...prev, ...optimisticPatch }));
    const { error } = await action();
    setPendingKey(null);
    if (error) {
      setLocal(restaurant); // roll back the optimistic change
      notify(error.message || 'Yenilənmədi, yenidən cəhd edin.', 'error');
      return;
    }
    notify('Yeniləndi.');
    onRefresh?.();
  };

  const flags = featureFlags(local);

  return (
    <div className="border-t border-slate-800 pt-3 mt-1 space-y-1">
      <p className="sa-caption font-bold text-slate-400 uppercase tracking-wider mb-1">Nəzarət</p>

      <Switch
        label="Restoran Aktiv"
        description={local.is_active === false ? 'Müştəri menyusu və admin/işçi paneli bağlıdır' : 'Müştəri menyusu və admin/işçi paneli açıqdır'}
        checked={local.is_active !== false}
        pending={pendingKey === 'is_active'}
        onChange={(val) => run('is_active', () => setRestaurantActiveState(local.id, val), { is_active: val })}
      />
      <Switch
        label={`Sınaq Müddəti (${TRIAL_LENGTH_DAYS} gün)`}
        description={local.subscription_status === 'trialing' ? `${daysUntil(local.trial_ends_at) ?? 0} gün qalıb` : 'Sınaqda deyil'}
        checked={local.subscription_status === 'trialing'}
        pending={pendingKey === 'trialing'}
        onChange={(val) => {
          if (val) {
            const trial_ends_at = new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000).toISOString();
            run('trialing', () => extendRestaurantTrial(local.id, TRIAL_LENGTH_DAYS), { subscription_status: 'trialing', trial_ends_at });
          } else {
            run('trialing', () => cancelRestaurantSubscription(local.id), { subscription_status: 'canceled' });
          }
        }}
      />
      <Switch
        label="Abunəlik Aktiv"
        description={local.subscription_status === 'active' ? 'Sınaqdan asılı olmayaraq tam giriş' : 'Abunəlik aktiv deyil'}
        checked={local.subscription_status === 'active'}
        pending={pendingKey === 'active'}
        onChange={(val) => run('active', () => (val ? markRestaurantActive(local.id) : cancelRestaurantSubscription(local.id)), { subscription_status: val ? 'active' : 'canceled' })}
      />
      <Switch
        label="Ödəniş gecikib (Past Due)"
        description="Manual olaraq ödəniş problemi işarələ"
        checked={local.subscription_status === 'past_due'}
        pending={pendingKey === 'past_due'}
        onChange={(val) => run('past_due', () => (val ? markRestaurantPastDue(local.id) : cancelRestaurantSubscription(local.id)), { subscription_status: val ? 'past_due' : 'canceled' })}
      />

      <div className="h-px bg-slate-800 my-2" />
      <p className="sa-caption font-bold text-slate-400 uppercase tracking-wider mb-1">Funksiyalar</p>
      {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => (
        <Switch
          key={key}
          label={meta.label}
          description={meta.description}
          checked={Boolean(flags[key])}
          pending={pendingKey === key}
          onChange={(val) => run(key, () => setRestaurantFeatureFlag(local, key, val), { feature_flags: { ...flags, [key]: val } })}
        />
      ))}
    </div>
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
