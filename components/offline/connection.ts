'use client'

import { useOffline } from 'next/offline'

// Whether the app has lost its connection. Next.js tells, from the browser's
// events and from requests that fail (see Ressources/offline-mode-codebase-plan.md).
// One place to read it, so the source can change without touching the screens.
export const useIsOffline = (): boolean => useOffline()
