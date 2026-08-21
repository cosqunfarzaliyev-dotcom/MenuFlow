// ============================================================================
// MenuFlow — pos-poster-menu-sync (Edge Function)
// ============================================================================
// Second backend component in the project (see supabase/functions/
// create-restaurant-user/index.ts's header for why an Edge Function is the
// deliberate, narrow exception to "there is no backend" here too): pulling
// menu/price data from Poster POS requires the restaurant's Poster access
// token, which lives in public.pos_integrations — a table with ZERO RLS
// policies and ZERO PostgREST grants (see supabase/migrations/
// 0026_pos_integration.sql). The only way to read it is a service-role
// client, which can never be shipped to the browser.
//
// Browser-invoked: the restaurant_admin/super_admin clicks "Sync menu now"
// in components/IntegrationsTab.jsx, which calls this via
// supabase.functions.invoke() with their own session JWT.
//
// SECURITY — same two-client, re-verify-the-caller discipline as
// create-restaurant-user: `callerClient` (the caller's own JWT) answers "who
// is this?", `adminClient` (service role) does everything else, and the
// caller's role/restaurant ownership is re-checked from their *verified*
// JWT-derived id, never trusted from the request body.
//
// SAHƏ SAHİBLİYİ — bax _shared/poster.ts-in özü deyil, aşağıdakı upsert
// məntiqi: INSERT-də MenuFlow-a məxsus sahələr (is_popular, options, ...)
// default-la doldurulur; UPDATE-də YALNIZ name/price/description/
// is_available/category_id üzərinə yazılır — bunların Poster-də qarşılığı
// olmayan merchandising sahələri (rating, prep_time_minutes, icon,
// sort_order və s.) heç vaxt toxunulmur.
//
// Deployed via the Supabase MCP server (`deploy_edge_function`), verify_jwt:
// true — this path always has a real user session.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { posterAdapter } from '../_shared/poster.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

// Same uniform shape as create-restaurant-user's fail() — client-side reads
// both error.context's `code`/`message` (functions.invoke() discards the
// body from error.message on non-2xx).
const fail = (status: number, code: string, message: string) => json(status, { ok: false, code, message });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return fail(500, 'SERVER_ERROR', 'Edge function environment is not configured.');
  }

  // --- 1. Who is calling? -------------------------------------------------
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

  // --- 2. Validate input ---------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  if (!UUID_RE.test(restaurantId)) {
    return fail(400, 'INVALID_INPUT', 'Restoran ID düzgün deyil.');
  }
  // Connection test: fetch from Poster and report what came back, but write
  // NOTHING — no catalogue upsert, no menu_sync_status. _shared/poster.ts's
  // header notes its Poster method names/payload shapes were written without a
  // live merchant account to verify against, so an admin needs a way to prove
  // the token + API shape work before a bad response half-writes the menu.
  const dryRun = body.dryRun === true;

  // --- 3. Is the caller allowed to manage THIS restaurant's integration? --
  // THE authorization gate. Mirrors public.is_admin_of() exactly (staff
  // excluded on purpose — POS credentials are never staff-reachable).
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('role, restaurant_id')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError) return fail(500, 'SERVER_ERROR', 'İstifadəçi profili oxunmadı.');

  const isSuperAdmin = callerProfile?.role === 'super_admin';
  const isOwningAdmin = callerProfile?.role === 'restaurant_admin' && callerProfile.restaurant_id === restaurantId;
  if (!isSuperAdmin && !isOwningAdmin) {
    return fail(403, 'FORBIDDEN', 'Bu restoran üçün səlahiyyətiniz yoxdur.');
  }

  // --- 4. Load the integration row (service role — bypasses the table's
  //        zero-policy RLS by design, see 0026's header comment) ----------
  const { data: integration, error: integrationError } = await adminClient
    .from('pos_integrations')
    .select('api_token, sync_menu_enabled')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'poster')
    .maybeSingle();

  if (integrationError) return fail(500, 'SERVER_ERROR', 'İnteqrasiya yoxlanılmadı.');
  if (!integration || !integration.api_token || !integration.sync_menu_enabled) {
    return fail(409, 'NOT_CONFIGURED', 'Poster POS inteqrasiyası quraşdırılmayıb və ya menyu sinxronu sönülüdür.');
  }

  // --- 4b. Connection test (dryRun) — read-only ---------------------------
  // Deliberately its own try/catch ABOVE the real sync: a failed connection
  // test must not write menu_sync_status='error', or merely probing the token
  // would make a working integration look broken in the Admin UI.
  if (dryRun) {
    try {
      const menu = await posterAdapter.fetchMenu(integration.api_token);
      return json(200, {
        ok: true,
        dryRun: true,
        categories: menu.categories.length,
        products: menu.products.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(502, 'POSTER_SYNC_FAILED', message);
    }
  }

  // --- 5. Pull the menu from Poster, then upsert -----------------------
  let categoriesUpserted = 0;
  let productsUpserted = 0;
  try {
    const menu = await posterAdapter.fetchMenu(integration.api_token);

    // Category id map: Poster external id -> MenuFlow category_id, built up
    // as each category is upserted, needed to resolve products' category_id
    // FK below (categories must land first, products second).
    const categoryIdByExternalId = new Map<string, string>();

    for (const category of menu.categories) {
      const { data: existing } = await adminClient
        .from('categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('pos_external_id', category.externalId)
        .maybeSingle();

      if (existing) {
        // UPDATE — only the Poster-owned field. icon/sort_order stay
        // whatever the admin already set in MenuFlow.
        const { error } = await adminClient.from('categories').update({ name: category.name }).eq('id', existing.id);
        if (error) throw error;
        categoryIdByExternalId.set(category.externalId, existing.id);
      } else {
        const { data: created, error } = await adminClient
          .from('categories')
          .insert({ restaurant_id: restaurantId, name: category.name, pos_external_id: category.externalId })
          .select('id')
          .single();
        if (error) throw error;
        categoryIdByExternalId.set(category.externalId, created.id);
      }
      categoriesUpserted += 1;
    }

    for (const product of menu.products) {
      const categoryId = categoryIdByExternalId.get(product.categoryExternalId) ?? null;

      const { data: existing } = await adminClient
        .from('products')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('pos_external_id', product.externalId)
        .maybeSingle();

      if (existing) {
        // UPDATE — only the 5 Poster-owned fields. is_popular/is_chef_choice/
        // is_spicy/is_vegetarian/options/rating/prep_time_minutes are
        // MenuFlow admin's own merchandising fields and are NEVER touched
        // here — Poster has no equivalent for any of them.
        const { error } = await adminClient
          .from('products')
          .update({ name: product.name, price: product.price, description: product.description, is_available: product.isAvailable, category_id: categoryId })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await adminClient.from('products').insert({
          restaurant_id: restaurantId,
          category_id: categoryId,
          name: product.name,
          price: product.price,
          description: product.description,
          is_available: product.isAvailable,
          pos_external_id: product.externalId,
          options: [],
          is_popular: false,
          is_chef_choice: false,
          is_spicy: false,
          is_vegetarian: false,
        });
        if (error) throw error;
      }
      productsUpserted += 1;
    }

    await adminClient
      .from('pos_integrations')
      .update({ menu_sync_status: 'success', menu_sync_error: null, menu_synced_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'poster');

    return json(200, { ok: true, categoriesUpserted, productsUpserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await adminClient
      .from('pos_integrations')
      .update({ menu_sync_status: 'error', menu_sync_error: message, menu_synced_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'poster');
    return fail(502, 'POSTER_SYNC_FAILED', message);
  }
});
