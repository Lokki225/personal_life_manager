// The app's service worker. Its only job is notifications: it shows the ones
// the server sends, and opens the right page when one is tapped. It stores
// nothing and never answers a page request, so it cannot serve a stale page.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let message = { title: 'Personal Life Manager', body: '', url: '/finance' }

  try {
    message = { ...message, ...event.data.json() }
  } catch {
    // A message that is not the expected shape is still shown, with the defaults.
  }

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/icons/192',
      badge: '/icons/192',
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Only pages of the app itself are opened, whatever the message said.
  const target = new URL(event.notification.data?.url || '/finance', self.location.origin)
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/finance'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client)

      if (open) {
        return open.navigate(url).then((client) => (client || open).focus())
      }

      return self.clients.openWindow(url)
    }),
  )
})
