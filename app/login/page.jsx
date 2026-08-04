"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabaseReady) {
      setError('Supabase qoşulmayıb. .env.local faylında real URL və Key təyin etməlisiniz.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Zəhmət olmasa e-poçt və şifrəni daxil edin.');
      return;
    }
    
    if (mode === 'signup' && password.length < 6) {
      setError('Şifrə ən azı 6 simvoldan ibarət olmalıdır.');
      return;
    }

    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        setSubmitting(false);
        if (signInError) {
          if (/email.*not.*confirmed/i.test(signInError.message || '')) {
            setError('E-poçt hələ təsdiqlənməyib. Zəhmət olmasa gələn təsdiq linkinə klikləyin (spam qovluğunu da yoxlayın).');
          } else if (/invalid.*credentials/i.test(signInError.message || '')) {
            setError('E-poçt və ya şifrə yanlışdır.');
          } else {
            setError(signInError.message || 'Giriş uğursuz oldu.');
          }
          return;
        }
        setChecking(true);
        await routeAfterAuth();
      } else {
        // Sign Up mode
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        setSubmitting(false);
        if (signUpError) {
          if (/user.*already.*registered/i.test(signUpError.message || '')) {
            setError('Bu e-poçt ünvanı ilə artıq hesab mövcuddur. "Daxil Ol" bölməsinə keçin.');
          } else {
            setError(signUpError.message || 'Qeydiyyat alınmadı.');
          }
          return;
        }

        if (data?.session) {
          setChecking(true);
          await routeAfterAuth();
          return;
        }

        setInfo('Hesab uğurla yaradıldı! Əgər e-poçt təsdiqi aktivdirsə, e-poçtunuza gələn linki klikləyin, sonra daxil olun.');
      }
    } catch (err) {
      setSubmitting(false);
      setError('Şəbəkə və ya server xətası baş verdi: ' + (err.message || 'Supabase serverinə qoşulmaq olmadı.'));
    }
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

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center shadow-2xl">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center border border-slate-800 mb-6">
          {next === '/superadmin' ? <ShieldCheck className="w-8 h-8 text-amber-500" /> : <Lock className="w-8 h-8 text-blue-500" />}
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800/80">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Daxil Ol
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'signup' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Qeydiyyat
          </button>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {mode === 'login' ? 'İdarəetmə Paneline Giriş' : 'Yeni Hesab Yaradın'}
        </h2>
        <p className="text-slate-400 text-xs mb-6">
          {mode === 'login'
            ? 'İdarəetmə panelinə daxil olmaq üçün e-poçt və şifrənizi yazın.'
            : 'MenuFlow-dan istifadə etmək üçün yeni hesab yaradın.'}
        </p>

        {!supabaseReady && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-5 text-amber-300 text-xs text-left leading-relaxed">
            <p className="font-bold text-amber-200 mb-1">⚠️ Supabase Qoşulmayıb!</p>
            <p className="text-[11px] text-amber-300/90">
              Qeydiyyat və Giriş üçün <code className="bg-amber-950 px-1 py-0.5 rounded border border-amber-800 text-amber-200">.env.local</code> faylında yer alan dummy məlumatları öz real Supabase <b>URL</b> və <b>Publishable Key</b> ünvanınızla əvəz edin.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="E-poçt ünvanınız" autoComplete="username" required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm mb-3 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifrə (min. 6 simvol)" autoComplete={mode === 'login' ? "current-password" : "new-password"} required
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-blue-500 transition-colors"
          />

          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-4 text-rose-400 text-xs text-left font-medium">{error}</div>}
          {info && <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4 text-emerald-400 text-xs text-left font-medium">{info}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            {submitting
              ? 'Gözləyin...'
              : mode === 'login'
              ? 'Daxil ol'
              : 'Qeydiyyatdan keç'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={submitting}
            className="w-full mt-3 py-2 bg-transparent hover:bg-slate-900 disabled:opacity-60 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            Şifrəni unutmusunuz?
          </button>
        )}

        <Link href="/" className="block mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Müştəri menyusuna qayıt
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

