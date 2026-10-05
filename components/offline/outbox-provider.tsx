'use client'

import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { useRouter } from 'next/navigation'

import type { OutboxItem } from '@/lib/offline/db'
import { flush, onOutboxChange, outboxItems } from '@/lib/offline/outbox'

import { useOfflineUser } from './offline-user'

type OutboxState = { items: OutboxItem[]; sendNow: () => Promise<void> }

const OutboxContext = createContext<OutboxState>({ items: [], sendNow: async () => {} })

const RETRY_EVERY_MS = 30_000

// Keeps the outbox moving: sends what waits when the app opens, when the
// connection comes back, when the page is shown again, and every 30 seconds
// while something waits. Screens show the server's truth again after a send.
export function OutboxProvider({ children }: PropsWithChildren) {
  const userId = useOfflineUser()
  const router = useRouter()
  const [items, setItems] = useState<OutboxItem[]>([])

  const sendNow = useCallback(async () => {
    if (!userId) return
    const { results } = await flush(userId)
    if ([...results.values()].some((result) => result.status === 'synced')) router.refresh()
  }, [userId, router])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const reload = async () => {
      const next = await outboxItems(userId)
      if (!cancelled) setItems(next)
    }
    void reload()
    void sendNow()

    const stop = onOutboxChange(() => void reload())
    const onOnline = () => void sendNow()
    const onVisible = () => document.visibilityState === 'visible' && void sendNow()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      stop()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, sendNow])

  const waiting = items.some((item) => item.status === 'pending')
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => void sendNow(), RETRY_EVERY_MS)
    return () => clearInterval(timer)
  }, [waiting, sendNow])

  return <OutboxContext.Provider value={{ items, sendNow }}>{children}</OutboxContext.Provider>
}

export const useOutbox = () => useContext(OutboxContext)
