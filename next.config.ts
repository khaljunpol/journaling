import type { NextConfig } from 'next';
import { LEGACY_REDIRECTS } from './src/lib/routes';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false }));
  },
};

export default nextConfig;
