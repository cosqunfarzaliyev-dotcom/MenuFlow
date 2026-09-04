// ============================================================================
// MenuFlow — epoint-confirm-payment (Edge Function)
// ============================================================================
// POLLED repeatedly by the customer's browser (every few seconds, via
// components/CustomerApp.jsx's Epoint widget overlay) while the Apple Pay /
// Google Pay widget iframe from epoint-create-payment is open — there is no
// redirect back to MenuFlow to react to any more (the customer never leaves
// the page at all, see epoint-create-payment's own header). This function is
// the one that actually learns what happened, by asking Epoint's own
// /1/get-status endpoint, and is the ONLY place that ever marks
// orders.payment_status = 'paid' for an Epoint payment.
//
// Being polled (rather than called once) is exactly why the idempotency
// check below matters in practice, not just in theory: the same transaction
// id is sent on every poll tick until the client sees 'success'/'error' and
// stops — this function must be safe to call many times in a row for the
// same transaction, which the early 'already success' return guarantees.
//
// AUTH MODEL — same as epoint-create-payment: no user session, verify_jwt is
// FALSE at deploy time. The gate here is deliberately NOT a token the client
// presents — the client sends nothing but the transaction id, and every fact
// used to settle the bill (restaurant_id, table_id, amount) is read back from
// payment_transactions (written server-side by epoint-create-payment) and
// confirmed against Epoint's own HTTPS response, never trusted from the
// request body. A stranger who guesses a transaction id can, at worst, cause
// one extra get-status lookup — they cannot mark anything paid unless Epoint
// itself reports success for that exact order_id.
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'INVALID_INPUT', 'Sorğu gövdəsi düzgün JSON deyil.');
  }
  const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
  if (!UUID_RE.test(transactionId)) {
    return fail(400, 'INVALID_INPUT', 'transactionId düzgün deyil.');
  }

  const { data: txn, error: txnError } = await adminClient
    .from('payment_transactions')
    .select('id, restaurant_id, table_id, amount, status')
    .eq('id', transactionId)
    .maybeSingle();
  if (txnError) return fail(500, 'SERVER_ERROR', 'Ödəniş sətri oxunmadı.');
  if (!txn) return fail(404, 'NOT_FOUND', 'Ödəniş tapılmadı.');

  // Idempotency — a page refresh on the return URL, or the effect re-firing,
  // must not re-hit Epoint or re-run the settle step below a second time.
  if (txn.status === 'success') {
    return json(200, { ok: true, status: 'success', amount: txn.amount });
  }

  const { data: integration, error: integrationError } = await adminClient
    .from('payment_integrations')
    .select('public_key, private_key')
    .eq('restaurant_id', txn.restaurant_id)
    .eq('provider', 'epoint')
    .maybeSingle();
  if (integrationError) return fail(500, 'SERVER_ERROR', 'İnteqrasiya yoxlanılmadı.');
  if (!integration?.public_key || !integration.private_key) {
    return fail(409, 'NOT_CONFIGURED', 'Epoint inteqrasiyası artıq mövcud deyil.');
  }

  let epointStatus: string;
  try {
    const response = await callEpoint('1/get-status', integration.private_key, {
      public_key: integration.public_key,
      transaction: transactionId,
    });
    epointStatus = typeof response.status === 'string' ? response.status : 'unknown';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(502, 'EPOINT_STATUS_FAILED', message);
  }

  if (epointStatus === 'new') {
    // Still pending on Epoint's side — write the latest-known status for
    // visibility, but stay 'pending' so the client (or a later mount) can
    // check again rather than being told it failed prematurely.
    await adminClient.from('payment_transactions').update({ epoint_status: epointStatus }).eq('id', transactionId);
    return json(200, { ok: true, status: 'pending', amount: txn.amount });
  }

  if (epointStatus !== 'success') {
    await adminClient
      .from('payment_transactions')
      .update({ status: 'error', epoint_status: epointStatus })
      .eq('id', transactionId);
    return json(200, { ok: true, status: 'error', amount: txn.amount });
  }

  // --- Success: settle every unpaid order for this table in one pass -------
  // Same effect as settle_table_payment()'s p_paid=true branch (0025), minus
  // the staff auth.uid() gate — the gate here is "Epoint itself confirmed
  // this exact order_id succeeded", checked above.
  const { error: settleError } = await adminClient
    .from('orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'epoint',
      payment_method_label: 'Epoint',
    })
    .eq('restaurant_id', txn.restaurant_id)
    .eq('table_id', txn.table_id)
    .eq('payment_status', 'unpaid')
    .neq('status', 'cancelled');
  if (settleError) return fail(500, 'SERVER_ERROR', 'Sifarişlər ödənilmiş kimi işarələnmədi.');

  await adminClient
    .from('alerts')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('restaurant_id', txn.restaurant_id)
    .eq('table_id', txn.table_id)
    .eq('type', 'bill')
    .eq('status', 'active');

  await adminClient
    .from('payment_transactions')
    .update({ status: 'success', epoint_status: epointStatus })
    .eq('id', transactionId);

  return json(200, { ok: true, status: 'success', amount: txn.amount });
});
