'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { useT } from '@/lib/i18n/client'

import { setNotificationChoiceAction } from './actions'

type Choice = 'notifyMoney' | 'notifyAdmin'

// Which notifications the person wants. Each is saved as soon as it is
// ticked; security notices cannot be turned off.
export function NotificationChoices({
  notifyMoney,
  notifyAdmin,
  isAdmin,
}: {
  notifyMoney: boolean
  notifyAdmin: boolean
  isAdmin: boolean
}) {
  const t = useT()
  const [values, setValues] = useState({ notifyMoney, notifyAdmin })
  const [saving, setSaving] = useState<Choice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startSaving] = useTransition()

  const change = (choice: Choice, value: boolean) => {
    setValues((current) => ({ ...current, [choice]: value }))
    setSaving(choice)
    setError(null)
    startSaving(async () => {
      const result = await setNotificationChoiceAction(choice, value)

      if (result.error) {
        // Back to what is saved.
        setValues((current) => ({ ...current, [choice]: !value }))
        setError(result.error)
      }

      setSaving(null)
    })
  }

  const options: { choice: Choice; label: string; text: string }[] = [
    {
      choice: 'notifyMoney',
      label: t('Reminders about my money'),
      text: t(
        'Spending to record, incomes to confirm, debts due, an overspend to explain, the month going too fast, the weekly Buffer transfer, a goal reached, a chest unlocking, a new month.',
      ),
    },
    ...(isAdmin
      ? [
          {
            choice: 'notifyAdmin' as const,
            label: t('Administration alerts'),
            text: t('A new account, a new opinion.'),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-3">
      {options.map(({ choice, label, text }) => (
        <label key={choice} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
          <input
            type="checkbox"
            checked={values[choice]}
            disabled={saving === choice}
            onChange={(event) => change(choice, event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-medium">
              {label}
              {saving === choice ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            </span>
            <span className="mt-0.5 block text-muted-foreground">{text}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        {t('Security notices are always sent: a changed password or email, a reset link, a new API key.')}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}
    </div>
  )
}
