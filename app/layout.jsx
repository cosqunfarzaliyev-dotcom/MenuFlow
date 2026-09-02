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
  // Only ever shown for a page that doesn't override it — every indexable
  // page lives under app/[locale]/ and supplies its own localized copy.
  // These are the crawl-level defaults that segment then narrows.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Without these three Google truncates the snippet, refuses a large
      // thumbnail, and skips video previews entirely — they are opt-IN, and
      // their absence (not a "noindex") is why a correctly-indexed page can
      // still render as a bare blue link with no image.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
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
