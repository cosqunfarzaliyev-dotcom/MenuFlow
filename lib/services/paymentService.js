// Wallet brand detection
// ---------------------------------------------------------------------------
// This file used to also trigger the native Apple Pay/Google Pay sheet
// directly (the W3C Payment Request API) and hand the resulting token back
// to the caller with nowhere real to send it — see git history
// (requestWalletPayment/GOOGLE_PAY_METHOD/APPLE_PAY_METHOD, removed) for why:
// there was no payment-processor backend wired in, so tapping either wallet
// button never actually charged anyone, only *looked* like it did.
//
// Real Apple Pay/Google Pay charging now goes through Epoint's Token Widget
// instead (hooks/useEpointWalletPayment.js, supabase/functions/epoint-
// create-payment + epoint-confirm-payment) — that widget is what actually
// shows the wallet sheet and processes the payment, embedded as an iframe in
// CustomerApp.jsx's bill modal and CartDrawer.jsx's checkout. All that's left
// here is picking WHICH BRAND TO LABEL that button with per device.
export const isApplePayAvailable = () =>
  typeof window !== 'undefined' && typeof window.ApplePaySession !== 'undefined';

// Which wallet brand to SHOW (label/icon) on the Epoint button — not a
// capability gate, the Epoint widget itself decides at open time what the
// device can actually do. isApplePayAvailable() is a real Safari-only signal
// (window.ApplePaySession only exists there); Android has no equivalent
// global, so a UA sniff is the only signal available for it. 'both' is the
// deliberate fallback for desktop/undetected devices, rendered as the
// combined "Apple Pay / Google Pay" label.
export const detectWalletBrand = () => {
  if (typeof window === 'undefined') return 'both';
  if (isApplePayAvailable()) return 'apple';
  if (/Android/i.test(navigator.userAgent || '')) return 'google';
  return 'both';
};
