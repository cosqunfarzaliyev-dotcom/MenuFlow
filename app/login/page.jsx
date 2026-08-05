"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, supabaseReady } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/services/authService';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';

const HOME_FOR_ROLE = {
  super_admin: '/superadmin',
  restaurant_admin: '/admin',
  staff: '/staff',
};

export default function LoginPage() {
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
    if (!supabaseReady) { setError('Supabase qoşulmayıb.'); return; }
    setSubmitting(true);
    setError('');
    setInfo('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      if (/email.*not.*confirmed/i.test(signInError.message || '')) {
        setError('E-poçt hələ təsdiqlənməyib. Zəhmət olmasa gələn təsdiq linkinə klikləyin (spam qovluğunu da yoxlayın).');
      } else {
        setError('E-poçt və ya şifrə yanlışdır.');
      }
      return;
    }
    setChecking(true);
    await routeAfterAuth();
  };

  const handleForgotPassword = async () => {
    if (!supabaseReady) { setError('Supabase qoşulmayıb.'); return; }
    if (!email.trim()) { setError('Şifrəni sıfırlamaq üçün əvvəlcə e-poçt ünvanınızı daxil edin.'); return; }
    setSubmitting(true);
    setError('');
    setInfo('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message || 'Sıfırlama linki göndərilmədi.');
      return;
    }
    setInfo('Şifrə sıfırlama linki e-poçtunuza göndərildi (spam qovluğunu da yoxlayın).');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabaseReady) { setError('Supabase qoşulmayıb.'); return; }
    setSubmitting(true);
    setError('');
    setInfo('');
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message || 'Qeydiyyat alınmadı.');
      return;
    }
    if (data?.session) {
      // Email confirmations are off — go straight to creating a restaurant.
      router.replace('/onboarding');
      return;
    }
    setInfo('Hesab yaradıldı! Təsdiq linki üçün e-poçtunuzu yoxlayın, sonra daxil olub restoranınızı yaradın.');
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
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center border border-slate-800 mb-6">
          {next === '/superadmin' ? <ShieldCheck className="w-8 h-8 text-amber-500" /> : <Lock className="w-8 h-8 text-blue-500" />}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Giriş</h2>
        <p className="text-slate-400 text-sm mb-6">İdarəetmə panelinə daxil olmaq üçün hesabınızla daxil olun.</p>

        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="E-poçt" autoComplete="username"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifrə" autoComplete="current-password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}
        {info && <p className="text-emerald-400 text-xs mb-4 text-left font-bold">{info}</p>}

        <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors">
          {submitting ? 'Yoxlanılır…' : 'Daxil ol'}
        </button>
        <button type="button" onClick={handleForgotPassword} disabled={submitting} className="w-full mt-2 py-2 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-500 hover:text-slate-300 text-xs transition-colors">
          Şifrəni unutmusunuz?
        </button>
        <button type="button" onClick={handleSignUp} disabled={submitting} className="w-full mt-1 py-2.5 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-400 hover:text-white rounded-xl font-bold text-xs transition-colors">
          Hesabınız yoxdur? Qeydiyyatdan keçin
        </button>
        <Link href="/" className="block mt-4 text-xs text-slate-500 hover:text-slate-300">Müştəri menyusuna qayıt</Link>
      </form>
    </div>
  );
}
