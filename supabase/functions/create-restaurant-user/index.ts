// ============================================================================
// MenuFlow — create-restaurant-user (Edge Function)
// ============================================================================
// THIS IS THE PROJECT'S ONLY BACKEND COMPONENT. Everything else in MenuFlow
// runs in the browser against Supabase directly with the anon/publishable key,
// with RLS + SECURITY DEFINER RPCs + triggers as the entire server side (see
// CLAUDE.md -> "There is no backend"). This function is a deliberate, narrow
// exception, and it exists for exactly one reason:
//
//   Creating a new `auth.users` row requires the service-role key. That key can
//   never be shipped to a browser. `public.profiles.id` has a hard FK to
//   `auth.users(id)`, so a super admin CANNOT pre-create a profile row for an
//   admin who hasn't signed up yet — which is why, before this function, the
//   only way to onboard a restaurant admin was to make them self-register at
//   /login first and then assign them by email. That public signup form has now
//   been removed entirely; this function replaces it.
//
// WHAT IT DOES: creates (or, for a leftover unassigned account, re-uses) an
// auth user with a super-admin-chosen one-time password, then attaches that
// user's profile to a restaurant with the requested role.
//
// SECURITY — same discipline as every SECURITY DEFINER RPC in this project
// (see upsert_alert() re-verifying the QR token, update_my_locale() re-deriving
// auth.uid() itself): a privileged callee NEVER trusts its caller. Concretely:
//   - The caller's role is read from the *verified JWT* they sent, never from
//     the request body. There is no `callerId`/`role` input, on purpose.
//   - Two separate Supabase clients are used, and they are not
//     interchangeable: `callerClient` carries the caller's own JWT and is used
//     ONLY to answer "who is this?"; `adminClient` holds the service-role key
//     and is used ONLY after authorization has already passed.
//   - `verify_jwt: true` is set at deploy time, so Supabase's gateway rejects
//     unsigned requests before this code runs. That is defense in depth, NOT
//     the authorization check — the gateway validates the token's signature,
//     it has no idea what `super_admin` means. Step 2 below is the real gate.
//
// Deployed via the Supabase MCP server (`deploy_edge_function`), mirroring how
// migrations are applied in this project: the file in the repo is the reviewable
// source of truth, the MCP call is the deployment mechanism.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ROLES = ['restaurant_admin', 'staff'];
const MIN_PASSWORD_LENGTH = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Deliberately permissive — real validation is Supabase Auth's own on
// createUser(). This only catches obvious typos before we spend a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

// Every failure goes through this so the client always gets the same shape.
// `code` is the stable, translatable discriminator; `message` is human-readable
// fallback text. lib/services/superAdminService.js reads both back off
// error.context (functions.invoke() swallows the body on non-2xx responses).
const fail = (status: number, code: string, message: string) =>
  json(status, { ok: false, code, message });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // These three are injected into the Edge runtime automatically; if any is
    // missing the deployment itself is misconfigured, so fail loudly rather
    // than falling back to a less privileged path.
    return fail(500, 'SERVER_ERROR', 'Edge function environment is not configured.');
  }

  // --- 1. Who is calling? -------------------------------------------------
  // Scoped to the caller's own JWT. This client can only ever see what that
  // user's RLS policies allow, which is the point: it cannot be tricked into
  // reporting someone else's identity.
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  const caller = userData?.user;
  if (userError || !caller) {
    return fail(401, 'UNAUTHORIZED', 'Bu əməliyyat üçün giriş tələb olunur.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 2. Is the caller a super admin? ------------------------------------
  // THE authorization gate. `caller.id` comes from the verified token, so this
  // is the Edge-Function equivalent of public.is_super_admin() re-deriving
  // auth.uid() inside the database rather than accepting a claimed identity.
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError) {
    return fail(500, 'SERVER_ERROR', 'İstifadəçi profili oxunmadı.');
  }
  if (callerProfile?.role !== 'super_admin') {
    return fail(403, 'FORBIDDEN', 'Bu əməliyyat üçün super admin səlahiyyəti tələb olunur.');
  }

  // --- 3. Validate input --------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }

  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' && body.role ? body.role : 'restaurant_admin';

  if (!UUID_RE.test(restaurantId)) {
    return fail(400, 'INVALID_INPUT', 'Restoran ID düzgün deyil.');
  }
  if (!EMAIL_RE.test(email)) {
    return fail(400, 'INVALID_INPUT', 'E-poçt ünvanı düzgün deyil.');
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return fail(400, 'INVALID_INPUT', 'Rol düzgün deyil.');
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return fail(400, 'INVALID_INPUT', `Şifrə ən azı ${MIN_PASSWORD_LENGTH} simvol olmalıdır.`);
  }

  // --- 4. Does the restaurant exist? --------------------------------------
  // Guards against a stale/mistyped id silently producing an admin attached to
  // nothing (the profiles.restaurant_id FK would catch it, but with a far less
  // useful error message).
  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) return fail(500, 'SERVER_ERROR', 'Restoran yoxlanılmadı.');
  if (!restaurant) return fail(404, 'RESTAURANT_NOT_FOUND', 'Restoran tapılmadı.');

  // --- 5. Existing account? -----------------------------------------------
  // `profiles` mirrors auth.users' email via the on_auth_user_created trigger,
  // so this one indexed lookup replaces paging through auth.admin.listUsers().
  const { data: existing, error: existingError } = await adminClient
    .from('profiles')
    .select('id, role, restaurant_id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) return fail(500, 'SERVER_ERROR', 'Mövcud hesab yoxlanılmadı.');

  let userId: string;
  let created: boolean;

  if (!existing) {
    if (!password) {
      return fail(400, 'PASSWORD_REQUIRED', 'Yeni hesab üçün şifrə tələb olunur.');
    }
    // email_confirm: true — the super admin is vouching for this address by
    // typing it, and the new admin must be able to sign in immediately with the
    // password they were handed. Without it they'd be stuck waiting for a
    // confirmation email that nobody asked for.
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !createdUser?.user) {
      // A duplicate here means an auth.users row exists with no matching
      // profiles row (step 5 found nothing) — rare, but report it as the
      // conflict it is rather than a generic 500.
      const msg = createError?.message || '';
      if (/already registered|already exists|duplicate/i.test(msg)) {
        return fail(409, 'EMAIL_TAKEN', 'Bu e-poçt ünvanı artıq istifadə olunur.');
      }
      return fail(500, 'SERVER_ERROR', msg || 'Hesab yaradılmadı.');
    }
    userId = createdUser.user.id;
    created = true;
  } else if (existing.role === 'unassigned' && !existing.restaurant_id) {
    // A leftover account with no restaurant — e.g. one created before public
    // signup was removed, or one a super admin previously detached via
    // removeUserFromRestaurant (which resets role to 'unassigned'). Safe to
    // adopt: nobody is currently relying on it.
    userId = existing.id;
    created = false;
    if (password) {
      const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (pwError) return fail(500, 'SERVER_ERROR', pwError.message || 'Şifrə yenilənmədi.');
    }
  } else {
    // Already an active admin/staff somewhere. Overwriting the password here
    // would hand a different tenant's account to whoever is filling in this
    // form — the single most important refusal in this function.
    return fail(409, 'EMAIL_TAKEN', 'Bu e-poçt artıq başqa bir restorana təyin edilib.');
  }

  // --- 6. Attach the profile to the restaurant ----------------------------
  // Always an UPDATE, never an INSERT: on_auth_user_created already created the
  // row (it's an AFTER INSERT trigger on auth.users, so it has committed by the
  // time createUser() resolves). The retry is belt-and-braces for replication
  // lag rather than a known failure mode.
  let attached = null;
  for (let attempt = 0; attempt < 2 && !attached; attempt += 1) {
    if (attempt > 0) await sleep(150);
    const { data, error } = await adminClient
      .from('profiles')
      .update({ role, restaurant_id: restaurantId })
      .eq('id', userId)
      .select('id, email, role, restaurant_id')
      .maybeSingle();
    if (error) return fail(500, 'SERVER_ERROR', error.message || 'Profil yenilənmədi.');
    attached = data;
  }

  if (!attached) {
    return fail(500, 'SERVER_ERROR', 'Profil tapılmadı, hesab restorana bağlanmadı.');
  }

  return json(200, { ok: true, userId, created, profile: attached });
});
