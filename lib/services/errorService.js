// ---------------------------------------------------------------------------
// Client-side error reporting (0047_client_error_log.sql).
//
// The app has almost no backend, so there were no server logs either: a JS
// error on a customer's phone was invisible to everyone except that customer.
// This is the one place the whole app reports through — swap the body of
// reportClientError() for a Sentry/PostHog call later and every caller follows.
//
// Two rules this file must never break:
//   1. It NEVER throws. An error reporter that can itself fail is worse than
//      none — it turns one broken render into a loop.
//   2. It never blocks. Every call is fire-and-forget.
//
// Server-side (the migration's trigger) handles what cannot be trusted from
// here: identity (auth.uid()), field truncation, and a per-minute rate limit.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';

// Which part of the product the error happened in. Derived from the URL rather
// than passed around, so a call site never has to know or get it wrong.
export const detectSurface = (pathname = '') => {
  if (pathname.startsWith('/menu')) return 'customer';
  if (pathname.startsWith('/superadmin')) return 'superadmin';
  if (pathname.startsWith('/admin') || pathname.startsWith('/onboarding')) return 'admin';
  if (pathname.startsWith('/staff')) return 'staff';
  return 'marketing';
};

// A broken render can fire the same error dozens of times a second. The DB
// rate limit is the real backstop, but de-duplicating here means we don't
// spend the whole minute's budget on one repeating message and lose the
// SECOND, different error that might be the actually useful one.
const seen = new Set();
const DEDUPE_LIMIT = 50;

export const reportClientError = ({ message, stack, surface } = {}) => {
  try {
    if (!supabaseReady || typeof window === 'undefined') return;
    const text = String(message || '').slice(0, 500);
    if (!text) return;

    const fingerprint = `${text}::${String(stack || '').slice(0, 200)}`;
    if (seen.has(fingerprint)) return;
    // Bounded so a page that generates endlessly-varying messages cannot grow
    // this set without limit.
    if (seen.size < DEDUPE_LIMIT) seen.add(fingerprint);

    // No await, and .then/.catch rather than try/catch — a rejected insert
    // must not surface as an unhandled rejection, which would re-enter the
    // window listener that called us.
    supabase
      .from('client_errors')
      .insert({
        message: text,
        stack: stack ? String(stack).slice(0, 4000) : null,
        url: window.location.href.slice(0, 500),
        user_agent: navigator.userAgent?.slice(0, 300) || null,
        surface: surface || detectSurface(window.location.pathname),
      })
      .then(() => {})
      .catch(() => {});
  } catch {
    // Deliberately silent — see rule 1 above.
  }
};

// Super admin panel — newest first. RLS (client_errors_super_admin_read)
// is what actually restricts this; there is no filter here to bypass.
export const fetchClientErrors = async ({ limit = 100 } = {}) => {
  if (!supabaseReady) return [];
  const { data, error } = await supabase
    .from('client_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('fetchClientErrors error:', error);
    return [];
  }
  return data || [];
};

export const deleteClientErrors = async (ids) => {
  if (!supabaseReady || !ids?.length) return { error: null };
  const { error } = await supabase.from('client_errors').delete().in('id', ids);
  if (error) console.error('deleteClientErrors error:', error);
  return { error };
};
