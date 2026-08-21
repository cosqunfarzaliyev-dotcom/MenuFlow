// Every authenticated panel (/admin, /staff, /superadmin, and their login
// pages) is disallowed — there is nothing there for a crawler to index, and
// middleware.js would bounce an unauthenticated crawler to a login page
// anyway. /menu/** (the customer QR menu) is ALSO disallowed: those pages
// are restaurant-specific and reached only via a printed QR code, never
// meant to be a public search-result entry point for an individual table.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://menuflow.az').replace(/\/$/, '');

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/staff', '/superadmin', '/superadmin-login', '/login', '/reset-password', '/onboarding', '/menu'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
