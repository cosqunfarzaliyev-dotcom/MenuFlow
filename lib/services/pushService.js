// ---------------------------------------------------------------------------
// Web Push subscription management (StaffApp.jsx "Bildirişləri aktivləşdir"
// button). Talks directly to public.push_subscriptions via PostgREST — no
// RPC needed, the table's own RLS policies (0030_push_notifications.sql)
// already restrict every row to `profile_id = auth.uid()`, and a
// BEFORE INSERT trigger there force-derives restaurant_id server-side so a
// client can't lie about which restaurant a subscription belongs to.
//
// The actual push delivery (VAPID signing, RFC 8291 payload encryption) is
// server-side only — supabase/functions/notify-push, invoked by the orders/
// alerts triggers, never from this file.
// ---------------------------------------------------------------------------
import { supabase, supabaseReady } from '@/lib/supabase';

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const getPushPermission = () => (isPushSupported() ? Notification.permission : 'unsupported');

// pushManager.subscribe() needs the VAPID public key as a raw Uint8Array,
// not the base64url string it's distributed as (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
// — this is the standard conversion every Web Push guide reaches for.
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

// Requests OS notification permission, subscribes via the browser's
// PushManager, and upserts the subscription row (onConflict: 'endpoint' —
// re-subscribing the same device/browser updates its keys in place instead
// of erroring on the unique constraint). Returns { error } only; the caller
// re-reads permission state from getPushPermission() rather than trusting a
// success boolean, since "permission denied" and "already subscribed" both
// need distinct UI and neither is really an "error".
export const subscribeToPush = async (profileId) => {
  if (!isPushSupported()) return { error: new Error('Bu brauzer bildirişləri dəstəkləmir.') };
  if (!supabaseReady) return { error: new Error('Supabase not ready') };

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { error: new Error('Bildiriş sistemi konfiqurasiya edilməyib.') };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { error: new Error('Bildiriş icazəsi verilmədi.') };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome/Firefox — every push must show a notification
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: profileId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' },
    );
    if (error) {
      console.error('subscribeToPush error:', error);
      return { error };
    }
    return { error: null };
  } catch (error) {
    console.error('subscribeToPush error:', error);
    return { error };
  }
};

export const unsubscribeFromPush = async () => {
  if (!isPushSupported() || !supabaseReady) return { error: null };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { error: null };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) console.error('unsubscribeFromPush error:', error);
    return { error: error || null };
  } catch (error) {
    console.error('unsubscribeFromPush error:', error);
    return { error };
  }
};

// Cheap "am I already subscribed on this device" check for StaffApp's
// button state — reads the browser's own PushManager, no network call.
export const isSubscribedOnThisDevice = async () => {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
};
