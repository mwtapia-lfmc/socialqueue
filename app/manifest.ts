import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SocialQueue',
    short_name: 'SocialQueue',
    description: 'Write once. Post everywhere.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f6fb',
    theme_color: '#6d5dfc',
    orientation: 'portrait',
    icons: [
      { src: '/pwa-icon?s=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?s=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?s=512&maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
