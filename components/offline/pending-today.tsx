'use client'

import { Clock } from 'lucide-react'

import { CURRENCY_CODE, todayFigures } from '@/domain/finance/calculations'
import { useT } from '@/lib/i18n/client'
import type { OutboxItem } from '@/lib/offline/db'

import { outboxItemLabel } from './outbox-item-label'
import { useOutbox } from './outbox-provider'

const sameDay = (iso: string, day: Date) => new Date(iso).toDateString() === day.toDateString()

// What today's expenses and savings waiting in the outbox change, before the
// server has them (offline spec §7).
export function pendingToday(items: OutboxItem[], day: Date) {
  const waiting = items.filter((item) => item.status === 'pending' && sameDay(item.occurredAt, day))
  const spent = waiting
    .filter((item) => item.action === 'finance.addExpense' && !(item.payload as { chestId?: string | null }).chestId)
    .reduce((sum, item) => sum + Number((item.payload as { amount: number }).amount), 0)
  const saved = waiting
    .filter((item) => item.action === 'finance.saveRemaining')
    .reduce((sum, item) => sum + Number((item.payload as { amount: number }).amount), 0)
  return { waiting, spent, saved }
}

// On Finance Today: the expenses still waiting to be sent, and what is left
// of the day once they are.
export function PendingToday({ budget, spent, saved }: { budget: number; spent: number; saved: number }) {
  const t = useT()
  const { items } = useOutbox()
  // The outbox holds what was captured on this device's clock today.
  const pending = pendingToday(items, new Date())

  if (pending.waiting.length === 0) {
    return null
  }

  const { remaining, overspend } = todayFigures({ budget, spent: spent + pending.spent, saved: saved + pending.saved })
  const money = (value: number) => `${t.amount(value)} ${CURRENCY_CODE}`

  return (
    <section className="space-y-2 rounded-xl border border-dashed bg-card p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('Waiting to be sent')}
      </p>
      <ul className="space-y-0.5 text-muted-foreground">
        {pending.waiting.map((item) => (
          <li key={item.id}>{outboxItemLabel(t, item)}</li>
        ))}
      </ul>
      {budget > 0 ? (
        <p>
          {overspend > 0
            ? t('Once sent: {amount} over today.', { amount: money(overspend) })
            : t('Once sent: {amount} left today.', { amount: money(remaining) })}
        </p>
      ) : null}
    </section>
  )
}
