import { CURRENCY_CODE } from '@/domain/finance/calculations'
import type { Translator } from '@/lib/i18n/translate'
import type { OutboxItem } from '@/lib/offline/db'

// One line saying what an outbox item is, e.g. "Expense 1,500 XOF · food · 09:12".
export function outboxItemLabel(t: Translator, item: OutboxItem): string {
  const payload = item.payload as { amount?: number; category?: string; title?: string; minutes?: number }
  const money = (value: number | undefined) => `${t.amount(value ?? 0)} ${CURRENCY_CODE}`
  const time = new Intl.DateTimeFormat(t.intl, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.occurredAt))

  const what = (() => {
    switch (item.action) {
      case 'finance.addExpense':
        return t('Expense {amount} · {category}', { amount: money(payload.amount), category: t(payload.category ?? '') })
      case 'finance.saveRemaining':
        return t('Saving {amount}', { amount: money(payload.amount) })
      case 'finance.recordException':
        return t('Overspend explained · {category}', { category: t(payload.category ?? '') })
      default:
        return t('An action')
    }
  })()

  return `${what} · ${time}`
}
