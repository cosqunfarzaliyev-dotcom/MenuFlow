"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, supabaseReady } from '@/lib/supabase';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { LanguageToggle } from '@/components/kit';
import { useAuthTranslation } from '@/lib/i18n/dictionaries/auth';

function ResetPasswordPageContent() {
  const { t } = useAuthTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabaseReady) { setReady(true); return; }

    // lib/supabase.js's createBrowserClient (@supabase/ssr) hardcodes
    // flowType: 'pkce', so the emailed recovery link — after Supabase's own
    // server verifies it — lands here as `/reset-password?code=...`, NOT as
    // the old implicit-flow `#access_token=...` hash that would fire
    // PASSWORD_RECOVERY on its own. Without this exchange no session is ever
    // established: getSession() stays null, PASSWORD_RECOVERY never fires,
    // and every real recovery link fell through to "Link etibarsızdır" even
    // though it was perfectly valid — this was the actual bug, not an
    // expired/malformed link.
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
        if (!exchangeError && data?.session) setHasRecoverySession(true);
        setReady(true);
      });
      return;
    }

    // Clicking the reset-password email link signs the user into a
    // short-lived "recovery" session and fires PASSWORD_RECOVERY here.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
      setReady(true);
    });
    // In case the event already fired before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setHasRecoverySession(true);
      setReady(true);
    });
    return () => listener?.subscription?.unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDontMatchShort'));
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(t('passwordNotUpdated')(updateError.message));
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/login'), 2000);
  };

  if (!ready) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
          <div className="h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 bg-blue-500/10 border-blue-500/25">
            <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t('invalidLinkTitle')}</h2>
          <p className="text-slate-400 text-sm mb-6">
            {t('invalidLinkDescription')}
          </p>
          <Link href="/login" className="block py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
          <div className="h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 bg-blue-500/10 border-blue-500/25">
            <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
          </div>
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t('passwordUpdatedTitle')}</h2>
          <p className="text-slate-400 text-sm">{t('redirectingToLogin')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center">
        <div className="flex justify-center mb-4">
          <LanguageToggle />
        </div>
        <div className="h-16 px-5 rounded-2xl mx-auto flex items-center justify-center border mb-6 bg-blue-500/10 border-blue-500/25">
          <Image src="/brand/menuflow-logo-dark-bg-h48.png" alt="MenuFlow" width={130} height={20} className="h-5 w-auto object-contain" unoptimized />
        </div>
        <div className="flex justify-center mb-2">
          <KeyRound className="w-5 h-5 text-blue-500" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('newPasswordTitle')}</h2>
        <p className="text-slate-400 text-sm mb-6">{t('newPasswordSubtitle')}</p>

        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')} autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <input
          type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('confirmNewPasswordPlaceholder')} autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors">
          {submitting ? t('updatingButton') : t('updatePasswordButton')}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={(
      <div className="kit-dark min-h-screen bg-[var(--k-bg)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
