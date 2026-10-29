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
    // "any" only: the icon has rounded corners and edge detail, so a maskable crop would cut into it.
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
