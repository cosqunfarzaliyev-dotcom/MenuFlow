import './globals.css'; // Global styles

export const metadata = {
  title: 'MenuFlow — Rəqəmsal QR Menyu vər İdarəetmə Sistemi',
  description: 'MenuFlow — Rəqəmsal QR Menyu vər İdarəetmə Sistemi',
};

export default function RootLayout({ children }) {
  return (
    <html lang="az" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
