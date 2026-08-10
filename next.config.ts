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
    ],
  },

  transpilePackages: ['motion'],

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