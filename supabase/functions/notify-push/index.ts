// ============================================================================
// MenuFlow — notify-push (Edge Function)
// ============================================================================
// Fourth backend component. Fans a Web Push notification out to every
// subscribed device (staff/restaurant_admin) for one restaurant, on new
// order / new waiter-call / new bill-request. Called exclusively by
// public.notify_push() (see supabase/migrations/0030_push_notifications.sql)
// — an internal SQL helper invoked from the orders/alerts AFTER INSERT
// triggers via pg_net's net.http_post(), never from a browser.
//
// AUTH MODEL — identical shape to pos-poster-order-push (0026/0027): a
// DB-trigger-initiated call has no user JWT, so verify_jwt is FALSE at
// deploy time and the real gate is a shared secret:
//   `x-push-notify-secret` header === Deno.env.get('PUSH_NOTIFY_SECRET')
// matching the value stored in Supabase Vault as 'push_notify_secret'
// (provisioned once via execute_sql, see 0030's trailing comment — never in
// the repo, same reasoning as SUPABASE_SERVICE_ROLE_KEY never appearing in
// code). This function is internet-reachable by design (a trigger can't
// present a browser session), so the secret comparison is the entire
// perimeter — treat PUSH_NOTIFY_SECRET with the same care as a service-role
// key.
//
// VAPID — Web Push requires the server to sign each push with a VAPID
// key pair (RFC 8292) so the push service (FCM/Mozilla/etc.) can verify the
// sender. Three additional secrets, distinct from PUSH_NOTIFY_SECRET above:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — generated once (see this
//     migration's own comment for the exact one-time generation command),
//     PUBLIC_KEY is also embedded client-side (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//     for pushManager.subscribe() — it is not a secret, only PRIVATE_KEY is.
//   VAPID_SUBJECT — a mailto: or https: URL identifying the sender, required
//     by the Web Push protocol so a push service can contact the sender if
//     a key is abused.
//
// Uses `npm:web-push` (Deno's npm compat layer) rather than hand-rolling
// RFC 8291 payload encryption + VAPID JWT signing — same reasoning
// pos-poster-order-push uses `npm:@supabase/supabase-js@2` instead of raw
// fetch: a well-known npm package on a well-specified protocol, imported via
// the same `npm:` specifier pattern already established in this project's
// other Edge Functions.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push@3';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-push-notify-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const fail = (status: number, code: string, message: string) => json(status, { ok: false, code, message });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pushSecret = Deno.env.get('PUSH_NOTIFY_SECRET');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!supabaseUrl || !serviceRoleKey || !pushSecret || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    // Same structural note as pos-poster-order-push: this branch runs before
    // any DB write is possible, so a caller can only diagnose it via the
    // Edge Function's own logs — there is no per-restaurant status row for
    // push (unlike pos_integrations.order_push_status) to surface "stuck"
    // notifications through, since a push failure has no single owning
    // admin screen the way POS sync does.
    return fail(500, 'SERVER_ERROR', 'Edge function environment is not configured.');
  }

  // --- 1. THE authorization gate — shared secret, not a JWT -----------------
  const suppliedSecret = req.headers.get('x-push-notify-secret') ?? '';
  if (suppliedSecret !== pushSecret) {
    return fail(401, 'UNAUTHORIZED', 'Etibarsız çağırış.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  // --- 2. Validate input ------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }
  const restaurantId = typeof body.restaurant_id === 'string' ? body.restaurant_id.trim() : '';
  const title = typeof body.title === 'string' ? body.title : 'MenuFlow';
  const bodyText = typeof body.body === 'string' ? body.body : '';
  const tag = typeof body.tag === 'string' ? body.tag : 'menuflow';
  if (!UUID_RE.test(restaurantId)) {
    return fail(400, 'INVALID_INPUT', 'restaurant_id düzgün deyil.');
  }

  // --- 3. Fan out to every subscribed device for this restaurant ------------
  const { data: subscriptions, error: subsError } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('restaurant_id', restaurantId);

  if (subsError) return fail(500, 'SERVER_ERROR', 'Abunəliklər oxunmadı.');
  if (!subscriptions || subscriptions.length === 0) {
    return json(200, { ok: true, sent: 0, failed: 0 });
  }

  const payload = JSON.stringify({ title, body: bodyText, tag });
  let sent = 0;
  let failedCount = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
        await adminClient
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq('id', sub.id);
      } catch (err) {
        failedCount += 1;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the push service says this endpoint is gone for good
        // (browser uninstalled, user cleared site data, subscription
        // expired) — delete it rather than let failure_count grow forever
        // for a device that will never come back. Any other error (e.g. a
        // transient network/push-service failure) just increments the
        // counter so a future push tries again.
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          await adminClient
            .from('push_subscriptions')
            .update({ failure_count: (sub.failure_count || 0) + 1 })
            .eq('id', sub.id);
        }
      }
    }),
  );

  return json(200, { ok: true, sent, failed: failedCount });
});
