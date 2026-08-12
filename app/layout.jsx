import './globals.css'; // Global styles

export const metadata = {
  title: 'MenuFlow — Rəqəmsal QR Menyu vər İdarəetmə Sistemi',
  description: 'MenuFlow — Rəqəmsal QR Menyu vər İdarəetmə Sistemi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="az" suppressHydrationWarning>
      {/* `.mf-dark` (app/globals.css) only declares --mf-* custom properties —
          it sets no background-color/color of its own, so mounting it here is
          purely additive. Without it, every dark-context primitive
          (Button/Input's existing pilot in DesignTab, plus Card/Modal/Alert/
          Tabs added in this phase) resolves var(--mf-primary) etc. to nothing,
          since a CSS custom property with no declared value anywhere in the
          ancestor chain is invalid at computed-value time. Customer routes
          are unaffected: CustomerApp/ProductDetailModal/CartDrawer each
          already re-declare the same --mf-* names on their own `.customer-theme`
          root (nearest-ancestor wins for custom-property inheritance), so
          this body-level default only ever reaches un-themed dark surfaces. */}
      <body suppressHydrationWarning className="mf-dark">{children}</body>
    </html>
  );
}
