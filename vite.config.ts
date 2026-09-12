import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deploy base path: '/' locally, '/studyflow/' on GitHub Pages (set by CI).
const base = process.env.STUDYFLOW_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  server: {
    // Dev against a local StudyFlow server (server mode): VITE_SERVER=1 npm run dev
    proxy: { '/api': process.env.STUDYFLOW_API ?? 'http://localhost:3000' },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'StudyFlow',
        short_name: 'StudyFlow',
        description: 'Offline-first učení s plánovačem podle termínů zkoušek a algoritmem FSRS.',
        lang: 'cs',
        theme_color: '#15151E',
        background_color: '#15151E',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache the full app shell so it loads with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        // Web-push handlers (public/push-sw.js) ride along with the generated SW.
        importScripts: ['push-sw.js'],
        // The app promises offline study, so the textbook has to survive a
        // train too. Slide renders never change under the same name → cache
        // first; the lecture texts can be refreshed when there is a network,
        // with the cached copy as the fallback. Only 200s are stored, so a
        // 401 after the session expires never poisons the cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/materials/img/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'materials-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname === '/api/materials' || url.pathname.startsWith('/api/materials/lecture/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'materials-text',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep dev fast; flip to true to exercise the service worker via `npm run dev`.
        enabled: false,
      },
    }),
  ],
})
