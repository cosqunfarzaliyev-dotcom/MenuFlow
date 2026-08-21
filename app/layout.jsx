import './globals.css'; // Global styles

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
