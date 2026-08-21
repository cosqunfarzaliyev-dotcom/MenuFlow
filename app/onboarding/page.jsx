"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, supabaseReady } from '@/lib/supabase';
import { Store, Loader2, Clock, LogOut } from 'lucide-react';
import { LanguageToggle } from '@/components/kit';
import { useAuthTranslation } from '@/lib/i18n/dictionaries/auth';
import { useAppStore } from '@/lib/store';
import { useLocaleSync } from '@/hooks/useLocaleSync';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// Two very different things happen on this route depending on the signed-in
// user's role (both gated server-side by middleware.js — see there for the
// actual enforcement, this component just renders the right one of the two):
//
//   - 'unassigned' (still the default for every new sign-up, D1 "Yol A" —
//     see CLAUDE.md -> Roles): no restaurant to set up yet. Shows the
//     pre-existing "pending activation" screen — nothing to do here but wait
//     for a super admin to assign a restaurant.
//   - 'restaurant_admin' with restaurants.onboarding_completed_at still null:
//     just activated by a super admin. Runs the OnboardingWizard
//     (components/onboarding/OnboardingWizard.jsx) to fill in the new
//     restaurant's info/branding/contact/menu before /admin opens up.
//
// 'restaurant_admin' with onboarding already done, 'staff', and 'super_admin'
// never see this render path in practice (middleware.js redirects them
// before the page even loads) — the fallback redirect below is defense in
// depth only, same reasoning as every other client-side check in this app.
export default function OnboardingPage() {
  const { t } = useAuthTranslation();
  const router = useRouter();
  const loadProfile = useAppStore((s) => s.loadProfile);
  const profile = useAppStore((s) => s.profile);
  const restaurant = useAppStore((s) => s.restaurant);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [view, setView] = useState(null); // 'pending' | 'wizard'

  useLocaleSync(profile?.locale);

  useEffect(() => {
    if (!supabaseReady) { setChecking(false); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.replace('/login?next=/onboarding');
        return;
      }
      setEmail(data.session.user.email || '');

      const p = await loadProfile();
      if (!p || p.role === 'unassigned') {
        setView('pending');
        setChecking(false);
        return;
      }
      if (p.role === 'restaurant_admin') {
        const r = useAppStore.getState().restaurant;
        if (r?.onboarding_completed_at) {
          // Already finished the wizard in a previous session — middleware
          // would already have bounced this away from /onboarding, but stay
          // consistent if it's ever reached directly (e.g. browser back).
          router.replace('/admin');
          return;
        }
        setView('wizard');
        setChecking(false);
        return;
      }
      // staff / super_admin shouldn't normally land here (see file header).
      const home = { super_admin: '/superadmin', staff: '/staff' }[p.role];
      router.replace(home || '/');
    })();
  }, [router, loadProfile]);

  const handleLogout = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    router.replace('/login');
  };

  if (checking) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (view === 'wizard') {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4 py-8">
        <OnboardingWizard restaurant={restaurant} profile={profile} />
      </div>
    );
  }

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center">
        <div className="flex justify-center mb-4">
          <LanguageToggle />
        </div>
        <div className="w-16 h-16 mx-auto bg-amber-500/15 rounded-2xl flex items-center justify-center border border-amber-500/30 mb-6">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('pendingActivationTitle')}</h2>
        <p className="text-slate-400 text-sm mb-1">{email}</p>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          {t('pendingActivationBody')}
        </p>

        <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl px-4 py-3 mb-6 text-left">
          <Store className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('superAdminHintPrefix')} <span className="text-slate-200 font-semibold">{t('superAdminLabel')}</span> {t('superAdminHintSuffix')}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" /> {t('logoutButton')}
        </button>
      </div>
    </div>
  );
}
