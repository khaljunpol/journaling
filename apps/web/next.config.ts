import type { NextConfig } from 'next';
import { LEGACY_REDIRECTS } from './src/lib/routes';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@journaling/core', '@journaling/sheets'],
  // Basic hardening for every page and API route. No CSP yet: the inline theme script would need a nonce first.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    }];
  },
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false }));
  },
};

export default nextConfig;
