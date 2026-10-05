import Dexie, { type EntityTable } from 'dexie'

// What the app keeps on the device (Ressources/offline-mode-codebase-plan.md):
// drafts of capture forms, snapshots of the screens readable offline, and the
// outbox of actions waiting for the connection. Everything is keyed by user,
// so two people on one device never see each other's data, and it is all
// wiped on sign out.

export type Draft = { userId: string; formId: string; values: Record<string, string>; savedAt: number }

export type Snapshot = { userId: string; key: string; data: unknown; savedAt: number }

export type OutboxItem = {
  id: string
  userId: string
  action: string
  payload: unknown
  occurredAt: string
  createdAt: number
  status: 'pending' | 'sending' | 'synced' | 'rejected'
  attempts: number
  error?: string
}

class OfflineDb extends Dexie {
  drafts!: EntityTable<Draft, 'formId'>
  snapshots!: EntityTable<Snapshot, 'key'>
  outbox!: EntityTable<OutboxItem, 'id'>

  constructor() {
    super('plm-offline')
    this.version(1).stores({
      drafts: '[userId+formId]',
      snapshots: '[userId+key]',
      outbox: 'id, userId, status, createdAt',
    })
  }
}

let db: OfflineDb | null = null

// The database, or null where IndexedDB is not available (server, private
// modes that block it). Callers then simply skip what they meant to store.
export function offlineDb(): OfflineDb | null {
  if (typeof indexedDB === 'undefined') return null
  db ??= new OfflineDb()
  return db
}

// Removes everything one person left on this device.
export async function clearUserData(userId: string) {
  const store = offlineDb()
  if (!store) return
  await Promise.all([
    store.drafts.where('[userId+formId]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).delete(),
    store.snapshots.where('[userId+key]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).delete(),
    store.outbox.where('userId').equals(userId).delete(),
  ])
}
