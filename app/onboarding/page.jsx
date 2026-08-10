"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { Store, Loader2, Clock, LogOut } from 'lucide-react';

// Super-admin-only account model (Master Plan D1, "Yol A"):
// signing up creates a *login* only — never a restaurant. A new account stays
// `unassigned` until a super admin creates a restaurant and assigns this user
// to it (SuperAdmin → Restaurants → assign by email, which calls
// assignUserToRestaurant). Self-service restaurant creation is disabled:
// create_restaurant_self_service is revoked from `authenticated` in
// supabase/migrations/0018_disable_self_service_onboarding.sql, so this page no
// longer offers a creation form — it just tells an unassigned user their
// account is pending activation. Assigned users are redirected to their panel.
export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');

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
        // Already assigned to a restaurant (or a super admin) — nothing to wait
        // for, send them to their own panel.
        const home = { super_admin: '/superadmin', restaurant_admin: '/admin', staff: '/staff' }[profile.role];
        router.replace(home || '/');
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  const handleLogout = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    router.replace('/login');
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
      <div className="w-full max-w-md bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center">
        <div className="w-16 h-16 mx-auto bg-amber-500/15 rounded-2xl flex items-center justify-center border border-amber-500/30 mb-6">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Hesabınız aktivləşdirilməyi gözləyir</h2>
        <p className="text-slate-400 text-sm mb-1">{email}</p>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Qeydiyyatınız uğurla tamamlandı. MenuFlow-da restoranlar və admin
          hesabları yalnız platforma administratoru tərəfindən yaradılır. Sizə
          bir restoran təyin ediləndən sonra idarəetmə panelinə giriş
          açılacaq.
        </p>

        <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-3 mb-6 text-left">
          <Store className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Platforma administratorusunuzsa, yeni restoran yaratmaq və bu hesabı
            ona admin təyin etmək üçün <span className="text-slate-200 font-semibold">Super Admin</span> panelindən istifadə edin.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Çıxış et
        </button>
      </div>
    </div>
  );
}
