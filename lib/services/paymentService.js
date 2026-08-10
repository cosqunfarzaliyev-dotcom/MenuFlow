// Google Pay / Apple Pay integration
// ---------------------------------------------------------------------------
// Both wallets are triggered through the standard W3C Payment Request API,
// which is what actually pops the native Apple Pay sheet in Safari/iOS and
// the native Google Pay sheet in Chrome/Android — there is no separate SDK
// needed to *show* the wallet UI.
//
// To go from "shows the wallet sheet" to "actually charges the customer's
// card", the returned payment token must be sent to a payment processor
// (Stripe, PayPal, etc.) from a server, using that processor's merchant
// account credentials. This project has no payment-processor backend or
// keys configured, so `confirmWalletPayment` below only collects the token
// and hands it back to the caller — wire it to your processor's API
// (e.g. POST the token to a Stripe PaymentIntent) before going live.
// Merchant identifiers/credentials belong in .env.local, never hard-coded.

const GOOGLE_PAY_METHOD = {
  supportedMethods: 'https://google.com/pay',
  data: {
    environment: 'TEST', // switch to 'PRODUCTION' once a real gateway + merchant ID are wired in
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: 'CARD',
        parameters: {
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['VISA', 'MASTERCARD'],
        },
      },
    ],
  },
};

const APPLE_PAY_METHOD = {
  supportedMethods: 'https://apple.com/apple-pay',
  data: {
    version: 3,
    merchantIdentifier: process.env.NEXT_PUBLIC_APPLE_PAY_MERCHANT_ID || 'merchant.menuflow.demo',
    merchantCapabilities: ['supports3DS'],
    supportedNetworks: ['visa', 'masterCard'],
    countryCode: 'AZ',
  },
};

export const isApplePayAvailable = () =>
  typeof window !== 'undefined' && typeof window.ApplePaySession !== 'undefined';

export const isGooglePayAvailable = () =>
  typeof window !== 'undefined' && typeof window.PaymentRequest !== 'undefined';

// Opens the native Apple Pay / Google Pay sheet for the given amount and
// resolves with the raw wallet payment token once the user approves it,
// or null if they cancel / the wallet isn't available.
export const requestWalletPayment = async ({ method, amount, currencyCode = 'AZN', label = 'MenuFlow sifariş' }) => {
  if (typeof window === 'undefined' || typeof window.PaymentRequest === 'undefined') {
    return { token: null, error: new Error('Bu brauzerdə Payment Request API dəstəklənmir.') };
  }

  const methodData = method === 'apple_pay' ? [APPLE_PAY_METHOD] : [GOOGLE_PAY_METHOD];
  const details = {
    total: {
      label,
      amount: { currency: currencyCode, value: Number(amount || 0).toFixed(2) },
    },
  };

  try {
    const request = new window.PaymentRequest(methodData, details);
    const canPay = await request.canMakePayment?.();
    if (canPay === false) {
      return { token: null, error: new Error('Bu cihazda Google Pay/Apple Pay aktiv deyil.') };
    }
    const response = await request.show();
    await response.complete('success');
    return { token: response.details, error: null };
  } catch (error) {
    // Includes the user simply dismissing the sheet — not a hard failure.
    return { token: null, error };
  }
};
