import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const frameHeaders = [
  ...securityHeaders,
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  devIndicators: false,

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      // Supabase Storage (0033_media_uploads.sql's `restaurant-media`
      // bucket — manually-uploaded product/category/logo images,
      // lib/services/storageService.js). Every <Image> that renders these
      // already passes `unoptimized`, which makes Next skip its own image
      // optimizer entirely and this allowlist moot in practice — this
      // entry exists for correctness/future-proofing in case `unoptimized`
      // is ever dropped from one of those call sites. Wildcarded to
      // `**.supabase.co` (project-ref subdomain) rather than one hardcoded
      // project id, so it isn't tied to a single environment.
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  transpilePackages: ['motion'],

  // Pre-locale-routing URLs (/pricing, /features, ...) redirected to their
  // AZ equivalent under app/[locale]/ — the content that used to live at
  // these paths was always AZ-first (lib/i18n/dictionaries/marketing.js's
  // `az` block is the fallback for every other locale), so /az/* is the
  // correct 1:1 target, not a locale guess. 308 (permanent, method-preserving)
  // rather than 307: these are real, indexed URLs being permanently moved,
  // not a temporary redirect. Redirects run before routing, so none of these
  // sources may ever collide with a real route — /admin, /staff, /superadmin,
  // /superadmin-login, /login, /reset-password, /onboarding, /stuff, /menu
  // all stay outside app/[locale]/ and are unaffected.
  async redirects() {
    return [
      { source: '/pricing', destination: '/az/pricing', permanent: true },
      { source: '/features', destination: '/az/features', permanent: true },
      { source: '/faq', destination: '/az/faq', permanent: true },
      { source: '/demo', destination: '/az/demo', permanent: true },
      { source: '/contact', destination: '/az/contact', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/admin',
        headers: frameHeaders,
      },
      {
        source: '/admin/:path*',
        headers: frameHeaders,
      },
      {
        source: '/staff',
        headers: frameHeaders,
      },
      {
        source: '/staff/:path*',
        headers: frameHeaders,
      },
      {
        source: '/superadmin',
        headers: frameHeaders,
      },
      {
        source: '/superadmin/:path*',
        headers: frameHeaders,
      },
    ];
  },
};

export default nextConfig;