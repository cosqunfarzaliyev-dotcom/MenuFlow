// ---------------------------------------------------------------------------
// Server-side Supabase client — for Server Components only (app/[locale]/**).
//
// Why a separate client instead of reusing lib/supabase.js's `supabase`:
// that one is built with createBrowserClient (@supabase/ssr), which is
// cookie-backed and expects to run in a request context with a browser
// session. Marketing pages are unauthenticated, statically generated, and
// have no session to read — using the browser client there would be
// misleading (it implies "this request might carry a signed-in user").
//
// This client is ALWAYS anonymous and never persists/refreshes a session
// (persistSession/autoRefreshToken/detectSessionInUrl all false) — that's
// the whole point: it can only ever read what site_content_public_read /
// products_public_read / etc. already expose to `anon`. It reuses
// createFallbackSupabase() from lib/supabase.js when env vars are absent,
// so the "no .env.local -> app still renders" guarantee (CLAUDE.md, "Local
// environment") holds for the server build too, not just the browser.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { createFallbackSupabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

export const supabaseServerReady = Boolean(supabaseUrl && supabasePublishableKey);

export const supabaseServer = supabaseServerReady
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : createFallbackSupabase();
