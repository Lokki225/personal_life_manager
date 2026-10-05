'use client'

import { useEffect } from 'react'

import { offlineDb, rememberOfflineUser } from '@/lib/offline/db'
import type { SnapshotData, SnapshotKey } from '@/lib/offline/snapshots'

import { useOfflineUser } from './offline-user'

// Keeps what this screen shows on the device, so it can be read offline.
// Written after every online visit; draws nothing.
export function SaveSnapshot<K extends SnapshotKey>({ snapshotKey, data }: { snapshotKey: K; data: SnapshotData[K] }) {
  const userId = useOfflineUser()

  useEffect(() => {
    if (!userId) return
    rememberOfflineUser(userId)
    void offlineDb()
      ?.snapshots.put({ userId, key: snapshotKey, data, savedAt: Date.now() })
      .catch(() => {
        // A device that refuses storage simply has nothing to show offline.
      })
  }, [userId, snapshotKey, data])

  return null
}
