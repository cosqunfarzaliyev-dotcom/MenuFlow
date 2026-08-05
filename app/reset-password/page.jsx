"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, supabaseReady } from '@/lib/supabase';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabaseReady) { setReady(true); return; }
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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Şifrə ən azı 8 simvol olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifrələr uyğun gəlmir.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message || 'Şifrə yenilənmədi.');
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/login'), 2000);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-2">Link etibarsızdır</h2>
          <p className="text-slate-400 text-sm mb-6">
            Bu şifrə sıfırlama linki artıq etibarsızdır və ya vaxtı bitib. Yenidən link göndərin.
          </p>
          <Link href="/login" className="block py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm">
            Giriş səhifəsinə qayıt
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-slate-950/60 p-8 rounded-3xl border border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Şifrə yeniləndi</h2>
          <p className="text-slate-400 text-sm">Giriş səhifəsinə yönləndirilirsiniz…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-950/60 backdrop-blur p-8 rounded-3xl border border-slate-800 text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center border border-slate-800 mb-6">
          <KeyRound className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Yeni şifrə</h2>
        <p className="text-slate-400 text-sm mb-6">Hesabınız üçün yeni şifrə təyin edin.</p>

        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Yeni şifrə" autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <input
          type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Şifrəni təsdiqləyin" autoComplete="new-password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {error && <p className="text-rose-500 text-xs mb-4 text-left font-bold">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-bold transition-colors">
          {submitting ? 'Yenilənir…' : 'Şifrəni yenilə'}
        </button>
      </form>
    </div>
  );
}
