import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Journaling',
    short_name: 'Journal',
    description: 'Daily activities, highlights, and consistency metrics',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#2563eb',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
