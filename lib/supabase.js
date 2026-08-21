import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

export const supabaseReady = Boolean(supabaseUrl && supabasePublishableKey);

if (!supabaseReady) {
  console.warn(
    "Supabase environment variables are missing or invalid. " +
      "Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

// A chainable no-op query builder so that code which forgets to check
// `supabaseReady` first fails gracefully (returns { data: null, error })
// instead of throwing "x is not a function" when Supabase isn't configured.
const notReadyError = () => new Error("Supabase client is not ready.");

const createFallbackQueryBuilder = () => {
  const result = Promise.resolve({ data: null, error: notReadyError() });
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    then: (onFulfilled, onRejected) => result.then(onFulfilled, onRejected),
    catch: (onRejected) => result.catch(onRejected),
  };
  return builder;
};

// Exported (not module-local) so lib/supabase-server.js can build the same
// no-op client for server-side marketing reads when Supabase env vars are
// absent at build time — same "app still renders using data/menu.json seed
// data" guarantee CLAUDE.md documents for the browser client, extended to
// the server.
export const createFallbackSupabase = () => ({
  from: () => createFallbackQueryBuilder(),
  channel: () => ({
    on: () => ({ subscribe: () => null }),
    subscribe: async () => ({ error: notReadyError() }),
  }),
  removeChannel: async () => {},
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: notReadyError() }),
    signUp: async () => ({ data: null, error: notReadyError() }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: notReadyError() }),
    }),
  },
});

// createBrowserClient (from @supabase/ssr) stores the session in cookies
// instead of localStorage. That's what lets middleware.js read and verify
// the session server-side on every request to /admin, /staff, /superadmin
// before any page code runs.
export const supabase = supabaseReady
  ? createBrowserClient(supabaseUrl, supabasePublishableKey, {
      realtime: {
        // keep realtime behavior predictable in Next.js environment
        params: { eventsPerSecond: 10 },
      },
    })
  : createFallbackSupabase();
