import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Charity Event Kit',
    short_name: 'Event Kit',
    description: 'Sign-ups, fair teams, live scores, and fundraising for charity events. By Gina Makes.',
    start_url: '/account',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f4ee',
    theme_color: '#d9481f',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
