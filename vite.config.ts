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
      },
      devOptions: {
        // Keep dev fast; flip to true to exercise the service worker via `npm run dev`.
        enabled: false,
      },
    }),
  ],
})
