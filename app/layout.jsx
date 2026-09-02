import './globals.css'; // Global styles
import { ErrorReporter } from '@/components/ErrorReporter';

// NEXT_PUBLIC_SITE_URL is optional in local dev (falls back to
// menuflow.az — a placeholder production domain); every generateMetadata()
// call under app/[locale]/** builds its `alternates.canonical`/`.languages`
// as ROOT-RELATIVE paths, so metadataBase is what actually resolves them
// into absolute URLs for the <link rel="canonical">/hreflang tags search
// engines read (01-app/03-api-reference/04-functions/generate-metadata.md,
// "metadataBase").
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://menuflow.az'),
  title: 'MenuFlow — Rəqəmsal QR Menyu və İdarəetmə Sistemi',
  description: 'MenuFlow — Rəqəmsal QR Menyu və İdarəetmə Sistemi',
  applicationName: 'MenuFlow',
  // Safe default: noindex. Every route OUTSIDE app/[locale]/** (admin, staff,
  // superadmin, login, superadmin-login, onboarding, reset-password, menu)
  // is a "use client" page and so cannot export its own `metadata` at all —
  // every one of them inherits whatever's declared here, unoverridden.
  // robots.txt already disallows crawling all of them, but that only stops a
  // well-behaved crawler from FETCHING the page; it does nothing once a URL
  // is already indexed some other way (a stray external link, a redirect).
  // An explicit noindex here is what actually gets a page like that dropped.
  // app/[locale]/layout.jsx overrides this with index:true for the pages
  // that are actually meant to rank.
  robots: { index: false, follow: false },
  // Turns off iOS Safari's auto-linking of anything that merely LOOKS like a
  // phone number (order ids, prices, table numbers) into a blue tel: link.
  formatDetection: { telephone: false, address: false, email: false },
};

export default function RootLayout({ children }) {
  // `.mf-dark` used to be mounted on <body> here as a fallback --mf-* source
  // for the old --mf-* primitive kit (deleted in this pass — see globals.css on
  // the three surviving design systems). The only remaining --mf-* consumer
  // is `.customer-theme` (CustomerApp/ProductCard/ProductDetailModal/
  // CartDrawer), which already re-declares its own --mf-* values on its own
  // root, so nothing needs a body-level default anymore.
  return (
    <html lang="az" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Renders nothing; attaches the window-level error listeners that
            report to client_errors (0047). Mounted at the ROOT so it covers
            the marketing site and all four panels, not just one surface. */}
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
