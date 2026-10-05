import { m } from '@/lib/i18n/translate'

import { OFFLINE_ACTIONS, isOfflineAction } from './actions'

// What can be corrected in an action the server refused, before it is sent
// again (offline plan, step 7). Whatever is not listed stays as it was.

export type EditableField = { name: string; label: string; kind: 'number' | 'text'; max?: number }

const amount = { name: 'amount', label: m('Amount'), kind: 'number' } as const

export const EDITABLE_FIELDS: Record<string, EditableField[]> = {
  'finance.addExpense': [amount, { name: 'description', label: m('Description'), kind: 'text', max: 80 }],
  'finance.saveRemaining': [amount],
  'finance.recordException': [{ name: 'reason', label: m('Reason'), kind: 'text', max: 160 }],
  'personal.logSession': [
    { name: 'minutes', label: m('Minutes'), kind: 'number' },
    { name: 'note', label: m('Note'), kind: 'text', max: 200 },
  ],
  'personal.saveDailyNote': [{ name: 'body', label: m('One line about today'), kind: 'text', max: 500 }],
}

export const editableFields = (action: string): EditableField[] => EDITABLE_FIELDS[action] ?? []

// The payload with the typed values in place, checked as the server will
// check it. Numbers may be typed with spaces or commas between thousands.
export function applyEdit(
  action: string,
  payload: unknown,
  values: Record<string, string>,
): { ok: true; payload: unknown } | { ok: false; error: string } {
  if (!isOfflineAction(action)) return { ok: false, error: m('This action cannot be sent from a device.') }

  const next: Record<string, unknown> = { ...(payload as object) }
  for (const field of editableFields(action)) {
    const raw = values[field.name]
    if (raw === undefined) continue
    if (field.kind === 'number') {
      next[field.name] = Number(raw.replace(/[\s,  ]/g, ''))
    } else {
      next[field.name] = raw.trim() === '' && field.name !== 'body' ? null : raw
    }
  }

  const parsed = OFFLINE_ACTIONS[action].safeParse(next)
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, error: m('Check the values and try again.') }
}
