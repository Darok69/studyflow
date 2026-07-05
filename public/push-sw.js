// Web-push handlers appended to the generated service worker via
// workbox importScripts. Shows the daily study reminder and focuses/opens
// the app on click.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* non-JSON push — show defaults */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'StudyFlow', {
      body: payload.body || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
      tag: 'studyflow-reminder',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const scope = self.registration.scope
      for (const win of windows) {
        if (win.url.startsWith(scope) && 'focus' in win) return win.focus()
      }
      return self.clients.openWindow(scope)
    }),
  )
})
