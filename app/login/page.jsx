"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { Loader2 } from 'lucide-react';
import { LanguageToggle } from '@/components/kit';
import { useAuthTranslation } from '@/lib/i18n/dictionaries/auth';

const HOME_FOR_ROLE = {
  super_admin: '/superadmin',
  restaurant_admin: '/admin',
  staff: '/staff',
};

const buildAuthOptions = (captchaToken = null, overrides = {}) => ({
  ...(captchaToken ? { captchaToken } : {}),
  ...overrides,
});

// Login only — there is no public sign-up any more. An account exists only
// because a super admin created it while creating the restaurant it belongs to
// (SuperAdmin -> Restaurants -> Yeni restoran, which also sets the admin's
// email + one-time password via the create-restaurant-user Edge Function). The
// old "Qeydiyyat" tab used to create an `unassigned` login that could do
// nothing until a super admin attached it to a restaurant anyway, so removing
// it took away a dead end, not a capability. See CLAUDE.md -> Roles (D1).
function LoginPageContent() {
  const { t } = useAuthTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const routeAfterAuth = useCallback(async () => {
    const profile = await fetchMyProfile();
    if (!profile || profile.role === 'unassigned') {
      router.replace('/onboarding');
      return;
    }
    const destination = (next && Object.values(HOME_FOR_ROLE).includes(next) ? next : HOME_FOR_ROLE[profile.role]) || '/';
    router.replace(destination);
  }, [router, next]);

  useEffect(() => {
    if (!supabaseReady) { setChecking(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        routeAfterAuth();
      } else {
        setChecking(false);
      }
    });
  }, [routeAfterAuth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabaseReady) { setError(t('supabaseNotConnected')); return; }
    if (!email.trim()) { setError(t('enterEmail')); return; }
    if (!password) { setError(t('enterPassword')); return; }

    setSubmitting(true);
    setError('');
    setInfo('');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: buildAuthOptions(undefined),
    });
    setSubmitting(false);
    if (signInError) {
      if (/email.*not.*confirmed/i.test(signInError.message || '')) {
        setError(t('emailNotConfirmed'));
      } else if (/rate limit|too many requests/i.test(signInError.message || '')) {
        // Supabase's own rate limiter (repeated failed attempts) was
        // previously indistinguishable from a genuinely wrong password —
        // both fell into the same generic message below, which is
        // misleading when the real cause is "wait and retry", not "check
        // your credentials".
        setError(t('tooManyAttempts'));
      } else {
        setError(t('wrongEmailOrPassword'));
      }
      return;
    }
    setChecking(true);
    await routeAfterAuth();
  };

  const handleForgotPassword = async () => {
    if (!supabaseReady) { setError(t('supabaseNotConnected')); return; }
    if (!email.trim()) { setError(t('enterEmailToReset')); return; }
    setSubmitting(true);
    setError('');
    setInfo('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      setError(t('resetLinkNotSent')(resetError.message));
      return;
    }
    setInfo(t('resetLinkSent'));
  };

  if (checking) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  // Still used: /staff gets its own title/subtitle and a distinct accent, the
  // same way /superadmin does. This has nothing to do with signup — it's just
  // which panel you're heading for.
  const isStaffLogin = next === '/staff';

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <LanguageToggle />
        </div>

        <div className={`h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 ${
          next === '/superadmin' ? 'bg-amber-500/10 border-amber-500/25' :
          isStaffLogin ? 'bg-emerald-500/10 border-emerald-500/25' :
          'bg-blue-500/10 border-blue-500/25'
        }`}>
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          {isStaffLogin ? t('staffLoginTitle') : t('loginTitle')}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {isStaffLogin ? t('staffLoginSubtitle') : t('loginSubtitle')}
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            autoComplete="username"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />

          {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}
          {/* `info` is still live — handleForgotPassword's success message. */}
          {info && <p className="text-emerald-400 text-xs mb-4 text-left font-bold">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors text-sm shadow-lg shadow-blue-600/20"
          >
            {submitting ? t('checkingButton') : t('loginTab')}
          </button>
        </form>

        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={submitting}
          className="w-full mt-2 py-2 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          {t('forgotPassword')}
        </button>

        <Link href="/" className="block mt-4 text-xs text-slate-500 hover:text-slate-300">
          {t('backToCustomerMenu')}
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={(
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )}>
      <LoginPageContent />
    </Suspense>
  );
}

