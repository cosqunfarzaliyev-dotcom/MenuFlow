"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { Loader2 } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui';
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

function LoginPageContent() {
  const { t } = useAuthTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setInfo('');
    setConfirmPassword('');
  };

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

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabaseReady) { setError(t('supabaseNotConnected')); return; }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(t('enterEmail'));
      return;
    }
    if (!password) {
      setError(t('enterPassword'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDontMatch'));
      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: buildAuthOptions(undefined, {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      }),
    });

    setSubmitting(false);

    if (signUpError) {
      if (/already registered|user_already_exists/i.test(signUpError.message || '')) {
        setError(t('accountAlreadyExists'));
      } else {
        setError(t('signupFailed')(signUpError.message));
      }
      return;
    }

    // Check for existing user (Supabase returns empty identities array for existing user when email confirmation is enabled)
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setError(t('accountAlreadyExists'));
      return;
    }

    if (data?.session) {
      // Email confirmation is OFF — proceed directly to onboarding
      router.replace('/onboarding');
      return;
    }

    // Email confirmation is ON — show verification instruction
    setInfo(t('accountCreatedVerifyEmail'));
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  const isStaffLogin = next === '/staff';
  const isLogin = isStaffLogin ? true : mode === 'login';

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <LanguageSwitcher context="dark" />
        </div>
        {/* Toggle Tabs (Only show if not logging into staff panel) */}
        {!isStaffLogin && (
          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                isLogin ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('loginTab')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                !isLogin ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('signupTab')}
            </button>
          </div>
        )}

        <div className={`h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 ${
          next === '/superadmin' ? 'bg-amber-500/10 border-amber-500/25' :
          isStaffLogin ? 'bg-emerald-500/10 border-emerald-500/25' :
          'bg-blue-500/10 border-blue-500/25'
        }`}>
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          {isStaffLogin ? t('staffLoginTitle') : isLogin ? t('loginTitle') : t('signupTitle')}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {isStaffLogin
            ? t('staffLoginSubtitle')
            : isLogin
            ? t('loginSubtitle')
            : t('signupSubtitle')}
        </p>

        <form onSubmit={isLogin ? handleLogin : handleSignUp}>
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
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />

          {!isLogin && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 transition-colors text-sm"
            />
          )}

          {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}
          {info && <p className="text-emerald-400 text-xs mb-4 text-left font-bold">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors text-sm shadow-lg shadow-blue-600/20"
          >
            {submitting ? t('checkingButton') : isLogin ? t('loginTab') : t('signupButton')}
          </button>
        </form>

        {isLogin && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={submitting}
            className="w-full mt-2 py-2 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            {t('forgotPassword')}
          </button>
        )}

        {!isStaffLogin && (
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
            disabled={submitting}
            className="w-full mt-2 py-2.5 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-colors"
          >
            {isLogin ? t('noAccountSignup') : t('haveAccountLogin')}
          </button>
        )}

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )}>
      <LoginPageContent />
    </Suspense>
  );
}

