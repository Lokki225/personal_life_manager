import { z } from 'zod'

import type { ApiUser } from '../api/operation'
import { operations } from '../api/operations'
import { notifyDevices } from '../notifications/notify'
import { askClaude, isAssistantConfigured, type AskModel } from '../../infrastructure/ai/claude'
import { assistantRepository, type AssistantRepository } from '../../infrastructure/repositories/assistantRepository'
import { now as clockNow, withClockZone } from '../../lib/clock'
import { noteInstructions } from './instructions'

// The notes the assistant writes on its own, each evening: a note about the
// day, the review of the week on Sundays, of the month on its last day.

export type NoteKind = 'daily' | 'weekly' | 'monthly'

export function noteKindFor(day: Date): NoteKind {
  const tomorrow = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)

  if (tomorrow.getMonth() !== day.getMonth()) {
    return 'monthly'
  }

  return day.getDay() === 0 ? 'weekly' : 'daily'
}

const ASK: Record<NoteKind, string> = {
  daily:
    "Write tonight's note: how today went against the daily budget, one thing worth noticing, and one concrete suggestion for tomorrow. If nothing was recorded today, gently remind them to record what they spent. Mention incomes waiting to be confirmed and debts due soon, if any.",
  weekly:
    'Write the review of the week that ends today: spending against the budget, overspends and their causes, what went into the chests, how the goals moved, and one or two concrete suggestions for next week.',
  monthly:
    'Write the review of the month that ends today: spending against the plan, overspends and their causes, what was saved, how the goals and debts moved, and two or three concrete suggestions for next month.',
}

// How the model hands over the note: in parts, so each lands in its place.
const DELIVER = 'deliver_note'
const delivered = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  details: z.string().trim().min(1),
})
const deliverTool = {
  name: DELIVER,
  description: 'Hands over the finished note.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'A short title, at most 50 characters.' },
      summary: { type: 'string', description: 'The gist, shown in the notification: at most 160 characters.' },
      details: { type: 'string', description: 'The full note, read in the app: at most 1200 characters.' },
    },
    required: ['title', 'summary', 'details'],
  },
}

export type Note = { kind: NoteKind; title: string; summary: string; details: string }

const cut = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text)

// Writes one note from the person's figures. One call to the model, with the
// figures given up front: a note costs the same whatever the model decides.
export async function writeNote(user: ApiUser, kind: NoteKind, now: Date, ask: AskModel = askClaude): Promise<Note> {
  const period = kind === 'monthly' ? 'month' : kind === 'weekly' ? 'week' : 'day'
  const [today, review, chests, goals, debts] = await Promise.all([
    operations.getToday.run(user, {}),
    operations.getReview.run(user, { period }),
    operations.getChests.run(user, {}),
    operations.getGoals.run(user, {}),
    operations.getDebts.run(user, {}),
  ])
  const figures = JSON.stringify({ today, review, chests, goals, debts })

  const { content } = await ask({
    system: noteInstructions(user, now),
    messages: [{ role: 'user', content: `${ASK[kind]}\n\nTheir figures, as JSON:\n${figures}` }],
    tools: [deliverTool],
    forceTool: DELIVER,
    maxTokens: 1500,
  })
  const handed = content.find((block) => block.type === 'tool_use' && block.name === DELIVER)
  const note = delivered.parse(handed?.type === 'tool_use' ? handed.input : undefined)

  return { kind, title: cut(note.title, 60), summary: cut(note.summary, 200), details: cut(note.details, 2000) }
}

// Notes older than this are forgotten.
const KEEP_DAYS = 120

type SendDeps = {
  configured: () => boolean
  repository: Pick<AssistantRepository, 'listNoteRecipients' | 'addNote' | 'pruneNotes'>
  write: typeof writeNote
  notify: typeof notifyDevices
}

const defaultSendDeps: SendDeps = {
  configured: isAssistantConfigured,
  repository: assistantRepository,
  write: writeNote,
  notify: notifyDevices,
}

// Runs once a day. Writes each person who asked for it their note, keeps it
// in the app and sends its gist to their devices. Resolves to who was notified,
// so the plain reminders do not repeat what the note already says.
export async function sendAssistantNotes(deps: SendDeps = defaultSendDeps): Promise<{ written: number; notified: Set<string> }> {
  const notified = new Set<string>()
  let written = 0

  if (!deps.configured()) {
    return { written, notified }
  }

  for (const person of await deps.repository.listNoteRecipients()) {
    // One person's trouble must not stop the notes of everyone after them.
    try {
      await withClockZone(person.timeZone, async () => {
        const now = clockNow()
        const note = await deps.write(person, noteKindFor(now), now)

        await deps.repository.addNote(person.id, { kind: note.kind, title: note.title, body: note.details })
        await deps.repository.pruneNotes(person.id, new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000))
        written += 1

        if ((await deps.notify(person.subscriptions, { title: note.title, body: note.summary, url: '/finance/assistant' })) > 0) {
          notified.add(person.id)
        }
      })
    } catch (error) {
      console.error('The assistant could not write a note:', error)
    }
  }

  return { written, notified }
}
