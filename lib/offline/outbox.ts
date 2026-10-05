import { offlineDb, type OutboxItem } from './db'
import type { OfflineAction, OfflinePayload, SyncResult } from './actions'

// The outbox (Ressources/offline-mode-codebase-plan.md, step 5): every capture
// action goes through it, online or not. Online it is sent at once; offline it
// waits on the device and goes as soon as the connection is back. The id the
// device gives an action is how the server makes sure it is done only once.

const CHANGED = 'plm-outbox-changed'
const BATCH = 50

const changed = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED))
}

export function onOutboxChange(listener: () => void) {
  window.addEventListener(CHANGED, listener)
  return () => window.removeEventListener(CHANGED, listener)
}

export async function enqueue<A extends OfflineAction>(userId: string, action: A, payload: OfflinePayload<A>): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    userId,
    action,
    payload,
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
  }
  await offlineDb()?.outbox.put(item)
  changed()
  return item
}

export async function outboxItems(userId: string): Promise<OutboxItem[]> {
  const store = offlineDb()
  if (!store) return []
  return (await store.outbox.where('userId').equals(userId).toArray()).sort((a, b) => a.createdAt - b.createdAt)
}

export async function discard(id: string) {
  await offlineDb()?.outbox.delete(id)
  changed()
}

// Sends a rejected item again, with what was corrected.
export async function retry(id: string, payload?: unknown) {
  await offlineDb()?.outbox.update(id, { status: 'pending', error: undefined, ...(payload === undefined ? {} : { payload }) })
  changed()
}

export type FlushOutcome = { results: Map<string, SyncResult>; reached: boolean }

let running: Promise<FlushOutcome> | null = null

// Sends what is waiting, oldest first. One send at a time; a second call
// waits for the running one.
export function flush(userId: string): Promise<FlushOutcome> {
  running ??= send(userId).finally(() => {
    running = null
  })
  return running
}

async function send(userId: string): Promise<FlushOutcome> {
  const results = new Map<string, SyncResult>()
  const store = offlineDb()
  if (!store) return { results, reached: false }

  for (;;) {
    const waiting = (await outboxItems(userId)).filter((item) => item.status === 'pending').slice(0, BATCH)
    if (waiting.length === 0) return { results, reached: true }

    let response: Response
    try {
      response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: waiting.map(({ id, action, payload, occurredAt }) => ({ id, action, payload, occurredAt })) }),
      })
    } catch {
      // No connection: everything stays, to be sent later.
      return { results, reached: false }
    }

    // Signed out, or too many sends: keep everything and try again later.
    if (!response.ok) return { results, reached: response.status !== 0 }

    const { results: answered } = (await response.json()) as { results: SyncResult[] }
    for (const result of answered) {
      results.set(result.id, result)
      if (result.status === 'synced') {
        await store.outbox.delete(result.id)
      } else if (result.status === 'rejected') {
        await store.outbox.update(result.id, { status: 'rejected', error: result.error })
      } else {
        const item = waiting.find((candidate) => candidate.id === result.id)
        await store.outbox.update(result.id, { attempts: (item?.attempts ?? 0) + 1 })
      }
    }
    changed()

    // A batch where nothing moved forward (all failed): stop for now.
    if (!answered.some((result) => result.status !== 'failed')) return { results, reached: true }
  }
}
