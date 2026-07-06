// Kill-switch service worker: the old test PWA (GitHub Pages) picks this up
// on its next update check, wipes its caches, unregisters itself, and sends
// every open window to the official app at study.dmarka.eu.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const windows = await self.clients.matchAll({ type: 'window' })
      for (const win of windows) {
        try {
          await win.navigate('https://study.dmarka.eu')
        } catch {
          /* window gone */
        }
      }
    })(),
  )
})
