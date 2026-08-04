"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { createRestaurantSelfService, TRIAL_LENGTH_DAYS } from '@/lib/services/billingService';
import { Store, Loader2, Sparkles } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');

  const [form, setForm] = useState({ name: '', slug: '', tagline: '', currencySymbol: '₼', tableCount: 20 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseReady) { setChecking(false); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.replace('/login?next=/onboarding');
        return;
      }
      setEmail(data.session.user.email || '');
      const profile = await fetchMyProfile();
      if (profile?.role && profile.role !== 'unassigned') {
        // Already belongs to a restaurant / already staff somewhere —
        // nothing to onboard, send them to their own panel.
        const home = { super_admin: '/superadmin', restaurant_admin: '/admin', staff: '/staff' }[profile.role];
        router.replace(home || '/');
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  const handleSlugChange = (value) => {
    setForm((f) => ({ ...f, slug: value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') }));
  };

  const handleNameChange = (value) => {
    setForm((f) => ({
      ...f,
      name: value,
      // Auto-fill the slug from the name until the user edits it directly.
      slug: f._slugTouched ? f.slug : value.toLowerCase().trim().replace(/[^a-z0-9\s-]+/g, '').replace(/\s+/g, '-'),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setSubmitting(true);
    setError('');
    const { restaurant, error: createError } = await createRestaurantSelfService({
      slug: form.slug.trim(),
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      currencySymbol: form.currencySymbol.trim() || '₼',
      tableCount: parseInt(form.tableCount, 10) || 20,
    });
    setSubmitting(false);
    if (createError) {
      setError(createError.message || 'Restoran yaradıla bilmədi.');
      return;
    }
    router.replace('/admin');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800">
        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-600/30 mb-6">
          <Store className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Restoranınızı yaradın</h2>
        <p className="text-slate-400 text-sm mb-1">{email}</p>
        <p className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-6">
          <Sparkles className="w-3.5 h-3.5" /> {TRIAL_LENGTH_DAYS} günlük pulsuz sınaq — kart lazım deyil
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">Restoran adı</label>
            <input value={form.name} onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Məs. Bakı Grill"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" required />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">Menyu linki</label>
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden focus-within:border-blue-500">
              <span className="pl-4 text-slate-500 text-sm whitespace-nowrap">menuflow.app/menu/</span>
              <input
                value={form.slug}
                onChange={(e) => { handleSlugChange(e.target.value); setForm((f) => ({ ...f, _slugTouched: true })); }}
                placeholder="baki-grill"
                className="flex-1 bg-transparent px-2 py-2.5 text-white text-sm focus:outline-none min-w-0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">Valyuta simvolu</label>
              <input value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">Masa sayı</label>
              <input type="number" min="1" max="200" value={form.tableCount} onChange={(e) => setForm({ ...form, tableCount: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">Tagline (istəyə bağlı)</label>
            <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Rəqəmsal QR Menyu"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        {error && <p className="text-rose-500 text-xs font-bold mt-4">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Restoranı yarat və başla
        </button>
        <p className="text-[10px] text-slate-500 text-center mt-4">
          Komanda üzvüsünüzsə və kimsə sizi artıq dəvət edibsə, bu formu doldurmayın —
          sadəcə <Link href="/login" className="underline">giriş edin</Link>.
        </p>
      </form>
    </div>
  );
}
