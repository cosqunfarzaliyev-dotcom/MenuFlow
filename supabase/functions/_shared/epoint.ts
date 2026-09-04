// ============================================================================
// MenuFlow — Epoint (epoint.az) wire-protocol helpers, shared by
// epoint-create-payment and epoint-confirm-payment.
// ============================================================================
// Verified against real Epoint source, not guessed: the redirect-based
// 1/payment-request + 1/get-status pair against rafoabbas/epoint-woocommerce-
// 9.x.x, and the Apple Pay/Google Pay 1/token/widget endpoint against
// rafoabbas/epoint-php (WidgetRequest/HasSignature). Both share the exact
// same envelope — see epoint-create-payment/index.ts and epoint-confirm-
// payment/index.ts for which endpoint each calls and why:
//   POST https://epoint.az/api/{path}
//     body (application/x-www-form-urlencoded):
//       data      = base64(JSON.stringify(payload))
//       signature = base64(sha1(private_key + data + private_key, RAW BYTES))
//     response: plain JSON, never wrapped/signed itself.
//
// `data` must be base64 of the UTF-8 BYTES of the JSON string — plain
// `btoa(json)` throws on any non-Latin1 character (this project's payloads
// carry Azerbaijani text, e.g. "hesabı"), so every string here goes through
// TextEncoder first.
// ============================================================================

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const utf8ToBase64 = (str: string): string => bytesToBase64(new TextEncoder().encode(str));

export const signEpointPayload = async (
  privateKey: string,
  payload: Record<string, unknown>,
): Promise<{ data: string; signature: string }> => {
  const data = utf8ToBase64(JSON.stringify(payload));
  const toHash = privateKey + data + privateKey;
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toHash));
  const signature = bytesToBase64(new Uint8Array(digest));
  return { data, signature };
};

// POSTs to https://epoint.az/api/{path} and returns the parsed JSON response.
// Throws on a network failure, a non-JSON body, or an HTTP-level error — the
// caller is responsible for writing back its own error/status columns.
export const callEpoint = async (
  path: string,
  privateKey: string,
  payload: Record<string, unknown>,
  timeoutMs = 10000,
): Promise<Record<string, unknown>> => {
  const { data, signature } = await signEpointPayload(privateKey, payload);
  const body = new URLSearchParams({ data, signature });

  const res = await fetch(`https://epoint.az/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Epoint cavabı düzgün JSON deyil (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return json;
};
