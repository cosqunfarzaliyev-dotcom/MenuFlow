import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { negotiateLocale } from '@/lib/i18n/server';

// Bare Server Component redirect, same shape as app/stuff/page.jsx's
// `redirect('/staff')` typo-catcher. Root `/` has no locale of its own — it
// negotiates one from the visitor's Accept-Language header (falling back to
// 'az', lib/i18n/server.js's DEFAULT_LOCALE) and redirects into
// app/[locale]/page.jsx, which is where the real homepage lives.
export default async function RootPage() {
  const acceptLanguage = (await headers()).get('accept-language');
  redirect(`/${negotiateLocale(acceptLanguage)}`);
}
