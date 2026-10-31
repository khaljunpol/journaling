import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A fixed id keeps the installed app the same app if start_url ever changes.
    id: '/quick',
    name: 'Journaling',
    short_name: 'Journal',
    description: 'Log your day in a few taps',
    start_url: '/quick',
    display: 'standalone',
    background_color: '#090b11', // --bg (dark)
    theme_color: '#090b11',
    orientation: 'portrait',
    icons: [
      { src: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
