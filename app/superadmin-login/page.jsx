"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { Field, Input, Button, Card, LanguageToggle } from '@/components/kit';
import { useAuthTranslation } from '@/lib/i18n/dictionaries/auth';

const HOME_FOR_ROLE = {
  super_admin: '/superadmin',
  restaurant_admin: '/admin',
  staff: '/staff',
};

// Dedicated SuperAdmin entry point — see app/login/page.jsx for the shared
// multi-role login this is modeled on. Login only, same as that page: there
// is no public sign-up anywhere in the app (see CLAUDE.md -> Roles, D1), and
// an open registration form here specifically would let anyone create the
// platform's most privileged account, which is exactly the hole D1 closed.
//
// Kept as its own top-level route (NOT nested under /superadmin) on purpose:
// middleware.js's PROTECTED_ROLES/matcher treat "/superadmin/:path*" as the
// protected panel itself, so a nested login page would need a carve-out in
// that server-side role gate for no real benefit. A sibling path needs no
// change there at all — same reason "/login" itself isn't in the matcher.
//
// Styled on components/kit, same as /login, /reset-password and /onboarding
// now are too (the old --mf-* primitive kit was retired). This page is the front
// door to the SuperAdmin panel specifically, which is fully on
// components/kit already (see components/SuperAdminApp.jsx). No `?next=`
// handling here (unlike /login) — this page has exactly one identity.
export default function SuperAdminLoginPage() {
  const { t } = useAuthTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Lazily-initialized from the plain module-level `supabaseReady` constant
  // (not a state read), not toggled synchronously inside the effect below —
  // avoids a react-hooks/set-state-in-effect violation that app/login/page.jsx
  // (the page this one is modeled on) already carries as one of this repo's
  // documented pre-existing lint problems. New code shouldn't add another.
  const [checking, setChecking] = useState(supabaseReady);

  // Route by the signed-in account's ACTUAL role, same as the shared login
  // page — an authenticated restaurant_admin/staff who ends up here still
  // lands on their own panel rather than an error screen. This page's
  // distinct identity is its branding/URL, not a new access-control check;
  // the real check is middleware.js + RLS, unchanged by this page's existence.
  const routeAfterAuth = useCallback(async () => {
    const profile = await fetchMyProfile();
    if (!profile || profile.role === 'unassigned') {
      router.replace('/onboarding');
      return;
    }
    router.replace(HOME_FOR_ROLE[profile.role] || '/');
  }, [router]);

  useEffect(() => {
    if (!supabaseReady) return; // checking already initialized to false above
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
    });
    setSubmitting(false);
    if (signInError) {
      if (/email.*not.*confirmed/i.test(signInError.message || '')) {
        setError(t('emailNotConfirmed'));
      } else if (/rate limit|too many requests/i.test(signInError.message || '')) {
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
        <Loader2 className="w-6 h-6 text-[var(--k-text-3)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          <LanguageToggle />
        </div>

        <div className="h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 bg-amber-500/10 border-amber-500/25">
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
        </div>

        <div className="flex justify-center mb-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--k-text)] mb-2">{t('superadminLoginTitle')}</h2>
        <p className="text-[var(--k-text-3)] text-sm mb-6">{t('superadminLoginSubtitle')}</p>

        <form onSubmit={handleLogin} className="space-y-3 text-left">
          <Field label={t('emailPlaceholder')}>
            {(id, a11y) => (
              <Input
                id={id}
                {...a11y}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                autoComplete="username"
              />
            )}
          </Field>
          <Field label={t('passwordPlaceholder')}>
            {(id, a11y) => (
              <Input
                id={id}
                {...a11y}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                autoComplete="current-password"
              />
            )}
          </Field>

          {error && <p className="text-[var(--k-danger)] text-xs font-bold">{error}</p>}
          {info && <p className="text-[var(--k-success)] text-xs font-bold">{info}</p>}

          <Button type="submit" variant="primary" size="block" loading={submitting}>
            {submitting ? t('checkingButton') : t('loginTab')}
          </Button>
        </form>

        <Button type="button" variant="ghost" size="block" className="mt-2" onClick={handleForgotPassword} disabled={submitting}>
          {t('forgotPassword')}
        </Button>

        <Link href="/login" className="block mt-4 text-xs text-[var(--k-text-3)] hover:text-[var(--k-text)]">
          {t('backToLogin')}
        </Link>
      </Card>
    </div>
  );
}
