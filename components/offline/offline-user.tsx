'use client'

import { createContext, useContext, type PropsWithChildren } from 'react'

// Who is signed in, for what the app keeps on this device (drafts, snapshots,
// outbox), which is always stored under that person.
const OfflineUserContext = createContext<string | null>(null)

export function OfflineUserProvider({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
  return <OfflineUserContext.Provider value={userId}>{children}</OfflineUserContext.Provider>
}

export const useOfflineUser = () => useContext(OfflineUserContext)
