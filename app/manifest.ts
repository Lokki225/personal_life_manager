import type { MetadataRoute } from 'next'

// What lets the app be installed on a phone's home screen and open like any
// other app. Installing is also what allows notifications on an iPhone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Personal Life Manager',
    short_name: 'Life Manager',
    description: 'Plan your income, know what today can afford, and keep what you save.',
    start_url: '/finance',
    display: 'standalone',
    background_color: '#0c1016',
    theme_color: '#0f172a',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
