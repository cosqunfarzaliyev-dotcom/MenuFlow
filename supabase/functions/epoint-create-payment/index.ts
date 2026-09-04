// ============================================================================
// MenuFlow — epoint-create-payment (Edge Function)
// ============================================================================
// Starts a real Epoint checkout for the customer's table bill via Epoint's
// TOKEN WIDGET (Apple Pay / Google Pay), embedded as an iframe INSIDE
// CustomerApp.jsx's own "Hesabı ödə" flow — never a full-page redirect to a
// separate Epoint-hosted checkout page. Reading the restaurant's Epoint
// private_key requires a service-role client — that key lives in
// public.payment_integrations, a table with ZERO RLS policies and ZERO
// PostgREST grants (see supabase/migrations/0048_epoint_payment_integration.
// sql) — same reasoning as pos-poster-menu-sync needing service role to read
// pos_integrations.
//
// PROTOCOL — verified against rafoabbas/epoint-php (the official-pattern PHP
// SDK), not guessed:
//   POST https://epoint.az/api/1/token/widget
//     body: data=base64(json{public_key, amount, order_id, description})
//          &signature=base64(sha1(private_key + data + private_key, RAW))
//     response: plain JSON {status:'success', widget_url}
//   widget_url is embedded directly as <iframe src=... allow="payment">
//   (see WidgetResponse::getWidgetUrl()'s own doc comment: "Get widget URL
//   for iframe/webview"). Apple Pay/Google Pay render INSIDE that iframe —
//   the customer never leaves menuflow's own page. There is no success/error
//   redirect URL for this endpoint (unlike the old 1/payment-request flow) —
//   completion is learned by polling epoint-confirm-payment (1/get-status)
//   from the client while the iframe is open, not from a callback.
//
// AUTH MODEL — no user session exists here at all: the caller is an
// unauthenticated customer's browser (components/CustomerApp.jsx's "Hesabı
// ödə" modal), calling via supabase.functions.invoke() the same way it calls
// the anon-granted get_table_orders()/place_order() RPCs directly. So
// verify_jwt is FALSE at deploy time, and the real gate is the QR token:
// step 2 below calls get_table_orders(), which internally re-verifies the
// token via verify_qr_token() and throws on anything stale/forged — this
// function never trusts restaurantId/tableId/amount from the request body
// beyond what that RPC's own result confirms.
//
// The unpaid total is computed HERE from get_table_orders()'s result, never
// accepted from the client — same "server-computed pricing" invariant as
// place_order()/price_order_item().
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { callEpoint } from '../_shared/epoint.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (!supabaseUrl || !serviceRoleKey) {
    return fail(500, 'SERVER_ERROR', 'Edge function environment is not configured.');
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 1. Validate input ----------------------------------------------------
  // No returnUrl/language here anymore — the widget endpoint has no
  // success/error redirect concept (see header) and WidgetRequest in the
  // reference SDK accepts only amount/order_id/description.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
  const tableId = typeof body.tableId === 'string' ? body.tableId.trim() : '';
  const qrToken = typeof body.qrToken === 'string' ? body.qrToken : '';

  if (!UUID_RE.test(restaurantId) || !UUID_RE.test(tableId) || !qrToken) {
    return fail(400, 'INVALID_INPUT', 'Restoran/masa məlumatı düzgün deyil.');
  }

  // --- 2. QR-token gate + server-computed amount, in one call --------------
  // Same function the customer's "Aktiv Sifarişlərim" screen already calls
  // directly — throws on an invalid/stale token (see 0025's own comment).
  const { data: ordersJson, error: ordersError } = await adminClient.rpc('get_table_orders', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_qr_token: qrToken,
  });
  if (ordersError) {
    return fail(401, 'INVALID_QR_TOKEN', ordersError.message || 'Etibarsız və ya köhnəlmiş QR link.');
  }
  const orders = Array.isArray(ordersJson) ? ordersJson : [];
  const unpaidOrders = orders.filter(
    (o: Record<string, unknown>) => o.payment_status === 'unpaid' && o.status !== 'cancelled',
  );
  const amount = unpaidOrders.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.total) || 0), 0);
  if (amount <= 0) {
    return fail(400, 'NOTHING_TO_PAY', 'Ödəniləcək məbləğ yoxdur.');
  }
  const tableNumber = unpaidOrders[0]?.restaurant_tables?.table_number ?? null;

  // --- 3. Load Epoint credentials --------------------------------------------
  const { data: integration, error: integrationError } = await adminClient
    .from('payment_integrations')
    .select('public_key, private_key, enabled')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'epoint')
    .maybeSingle();

  if (integrationError) return fail(500, 'SERVER_ERROR', 'İnteqrasiya yoxlanılmadı.');
  if (!integration || !integration.enabled || !integration.public_key || !integration.private_key) {
    return fail(409, 'NOT_CONFIGURED', 'Epoint onlayn ödənişi bu restoran üçün quraşdırılmayıb.');
  }

  // --- 4. Create the transaction row, then ask Epoint for a widget URL -----
  // Row shape/idempotency is unchanged from the redirect-based design (0048)
  // — epoint-confirm-payment's polling logic works identically regardless of
  // how the customer reached "Epoint said success": id is still what we send
  // Epoint as order_id, and what we later send back as `transaction` to
  // 1/get-status.
  const { data: transaction, error: insertError } = await adminClient
    .from('payment_transactions')
    .insert({ restaurant_id: restaurantId, table_id: tableId, amount, currency: 'AZN', status: 'pending' })
    .select('id')
    .single();
  if (insertError || !transaction) return fail(500, 'SERVER_ERROR', 'Ödəniş sətri yaradılmadı.');

  const transactionId = transaction.id as string;

  try {
    const response = await callEpoint('1/token/widget', integration.private_key, {
      public_key: integration.public_key,
      amount: Number(amount.toFixed(2)),
      order_id: transactionId,
      description: tableNumber ? `MenuFlow — masa ${tableNumber} hesabı` : 'MenuFlow hesabı',
    });

    if (response.status !== 'success' || typeof response.widget_url !== 'string') {
      const message = typeof response.message === 'string' ? response.message : 'Epoint widget yaradıla bilmədi.';
      await adminClient
        .from('payment_transactions')
        .update({ status: 'error', error_message: message })
        .eq('id', transactionId);
      return fail(502, 'EPOINT_REQUEST_FAILED', message);
    }

    // `amount` is echoed back so the client can display the REAL charge —
    // it covers the table's entire current unpaid balance (computed above
    // from get_table_orders(), never the client's own locally-tracked cart
    // total), which can be more than what a just-created order's own total
    // shows if the table already had an earlier unpaid order.
    return json(200, { ok: true, widgetUrl: response.widget_url, transactionId, amount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await adminClient
      .from('payment_transactions')
      .update({ status: 'error', error_message: message })
      .eq('id', transactionId);
    return fail(502, 'EPOINT_REQUEST_FAILED', message);
  }
});
