import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseReady) {
  console.warn(
    "Supabase environment variables are missing or invalid. " +
      "Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

const createFallbackSupabase = () => ({
  from: () => ({ data: null, error: new Error("Supabase client is not ready.") }),
  channel: () => ({
    on: () => ({ subscribe: () => null }),
    subscribe: () => null,
  }),
  removeChannel: () => {},
  auth: {
    signIn: async () => ({ data: null, error: new Error("Supabase client is not ready.") }),
    signUp: async () => ({ data: null, error: new Error("Supabase client is not ready.") }),
    signOut: async () => ({ data: null, error: new Error("Supabase client is not ready.") }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: new Error("Supabase client is not ready.") }),
    }),
  },
});

export const supabase = supabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : createFallbackSupabase();
