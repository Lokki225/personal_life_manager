/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist'

// The app's service worker (Ressources/offline-mode-codebase-plan.md, step 3).
//
// It keeps the app's own files (scripts, styles, fonts, icons) so the app can
// open without a connection, and shows the offline page when a page cannot be
// loaded. It never stores a signed-in page: what a person sees offline comes
// from the snapshots on their device, which are wiped on sign out.
//
// It also shows push notifications and opens the right page when one is
// tapped. It is served at /sw.js, the address existing subscriptions use.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Built files never change under the same name.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'static',
        plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && (url.pathname.startsWith('/icons/') || url.pathname === '/icon.svg'),
      handler: new CacheFirst({ cacheName: 'icons' }),
    },
    {
      // Pages and data always come from the server.
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
})

serwist.addEventListeners()

// --- Notifications ---------------------------------------------------------

self.addEventListener('push', (event) => {
  let message = { title: 'Personal Life Manager', body: '', url: '/finance' }

  try {
    message = { ...message, ...event.data?.json() }
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
      const open = windows.find((client) => 'focus' in client) as WindowClient | undefined

      if (open) {
        return open.navigate(url).then((client) => (client || open).focus())
      }

      return self.clients.openWindow(url)
    }),
  )
})

