'use client'

import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n/client'
import type { OutboxItem } from '@/lib/offline/db'
import { applyEdit, editableFields } from '@/lib/offline/edit'
import { discard, retry } from '@/lib/offline/outbox'

import { outboxItemLabel } from './outbox-item-label'

// One action the server refused, with its reason: correct it and send it
// again, send it as it is, or let it go.
export function RefusedItem({ item, sendNow }: { item: OutboxItem; sendNow: () => Promise<void> }) {
  const t = useT()
  const fields = editableFields(item.action)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const payload = item.payload as Record<string, unknown>

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = Object.fromEntries([...new FormData(event.currentTarget)].map(([name, value]) => [name, String(value)]))
    const edited = applyEdit(item.action, item.payload, values)
    if (!edited.ok) return setError(t(edited.error))
    setError(null)
    setEditing(false)
    void retry(item.id, edited.payload).then(sendNow)
  }

  return (
    <li className="rounded-lg border p-2">
      <p>{outboxItemLabel(t, item)}</p>
      <p className="text-xs text-destructive-strong">{item.error}</p>

      {editing ? (
        <form onSubmit={submit} className="mt-2 space-y-2" noValidate>
          {fields.map((field) => (
            <div key={field.name} className="grid gap-1">
              <Label htmlFor={`refused-${item.id}-${field.name}`} className="text-xs">
                {t(field.label)}
              </Label>
              <Input
                id={`refused-${item.id}-${field.name}`}
                name={field.name}
                defaultValue={payload[field.name] == null ? '' : String(payload[field.name])}
                inputMode={field.kind === 'number' ? 'numeric' : undefined}
                maxLength={field.max}
                className="h-9 text-sm"
              />
            </div>
          ))}
          {error ? <p className="text-xs text-destructive-strong">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="h-8 text-xs">
              {t('Send again')}
            </Button>
            <Button type="button" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-1.5 flex gap-2">
          {fields.length > 0 ? (
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => setEditing(true)}>
              {t('Correct')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void retry(item.id).then(sendNow)}>
            {t('Try again')}
          </Button>
          <Button type="button" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => void discard(item.id)}>
            {t('Discard')}
          </Button>
        </div>
      )}
    </li>
  )
}
