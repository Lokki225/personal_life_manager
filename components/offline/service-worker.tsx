'use client'

import { useEffect } from 'react'

// Registers the service worker for everyone (it used to be only for those who
// turned notifications on), and asks the browser to keep the app's local data
// instead of clearing it when space runs low. No prompt is shown for either.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without a service worker the app still works online.
    })
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  return null
}
