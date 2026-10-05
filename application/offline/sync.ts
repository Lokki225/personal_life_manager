import { FinanceRuleError, isFinanceRuleError } from '../../domain/finance/errors'
import { isSameDay, occurredAtProblem } from '../../domain/offline/capture'
import { isPersonalRuleError } from '../../domain/personal/errors'
import { syncReceiptRepository } from '../../infrastructure/repositories/syncReceiptRepository'
import { zonedNow } from '../../lib/clock'
import { withOrigin } from '../../lib/origin'
import { isOfflineAction, OFFLINE_ACTIONS, type OfflineAction, type OfflinePayload, type SyncResult } from '../../lib/offline/actions'
import { recordChestExpense } from '../finance/chestExpense'
import { recordLateExpense } from '../finance/lateExpense'
import { recordDailyException } from '../finance/recordDailyException'
import { recordDailyExpense } from '../finance/recordDailyExpense'
import { saveDailyRemaining } from '../finance/saveDailyRemaining'
import { saveDailyNote } from '../personal/journal'
import { logSession } from '../personal/sessions'
import { setTaskDone } from '../personal/tasks'

// Runs the actions a device captured offline and sends from its outbox, with
// the same use cases as the forms (Ressources/offline-mode-codebase-plan.md,
// step 5). Each item is handled on its own: one refused item never blocks
// the others.

export type SyncUser = { id: string; timeZone: string | null; settledThrough: Date | null }

// `occurredAt` is on the person's clock; `instant` is the real moment, to compare with server times.
type Handler<A extends OfflineAction> = (user: SyncUser, payload: OfflinePayload<A>, occurredAt: Date, now: Date, instant: Date) => Promise<unknown>

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const DAY_IS_OVER = 'That day is over: what was left of it goes to your Buffer on its own.'

const HANDLERS: { [A in OfflineAction]: Handler<A> } = {
  'finance.addExpense': async (user, expense, occurredAt, now) => {
    const input = {
      userId: user.id,
      amount: expense.amount,
      category: expense.category,
      description: expense.description ?? null,
      cause: expense.cause ?? null,
      reason: expense.reason ?? null,
    }

    if (expense.chestId) {
      return recordChestExpense({ ...input, chestId: expense.chestId }, undefined, occurredAt)
    }

    // A day already closed had its leftover moved to the Buffer without it.
    const closed = !isSameDay(occurredAt, now) && user.settledThrough !== null && dayStart(user.settledThrough) >= dayStart(occurredAt)
    if (closed) {
      return recordLateExpense({ ...input, occurredAt })
    }

    return recordDailyExpense(input, undefined, occurredAt)
  },

  'finance.saveRemaining': async (user, saving, occurredAt, now) => {
    if (!isSameDay(occurredAt, now)) throw new FinanceRuleError(DAY_IS_OVER)
    return saveDailyRemaining({ userId: user.id, amount: saving.amount, destinationChestId: saving.destinationChestId ?? null })
  },

  'finance.recordException': async (user, exception, occurredAt, now) => {
    if (!isSameDay(occurredAt, now)) throw new FinanceRuleError("That day is over: its overspend can no longer be explained from here.")
    return recordDailyException({ userId: user.id, category: exception.category, reason: exception.reason ?? null }, undefined, now)
  },

  // A tick is for the day it was made, even when it arrives later.
  'personal.toggleTask': async (user, toggle, occurredAt) => setTaskDone(user.id, toggle.taskId, toggle.done, occurredAt),

  'personal.logSession': async (user, session, occurredAt) =>
    logSession(user.id, { minutes: session.minutes, goalId: session.goalId ?? null, note: session.note ?? null, endedAt: occurredAt }),

  // The day's line: the latest written wins, even across devices.
  'personal.saveDailyNote': async (user, note, occurredAt, _now, instant) => saveDailyNote(user.id, note.body, occurredAt, undefined, instant),
}

type Deps = Pick<typeof syncReceiptRepository, 'claim' | 'release'> & { handlers: typeof HANDLERS }
const defaultDeps: Deps = { ...syncReceiptRepository, handlers: HANDLERS }

export async function processSyncItems(
  user: SyncUser,
  items: { id: string; action: string; payload: unknown; occurredAt: string }[],
  now: Date,
  translate: (message: string) => string,
  deps: Deps = defaultDeps,
): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  for (const item of items) {
    results.push(await processOne(user, item, now, translate, deps))
  }

  return results
}

async function processOne(
  user: SyncUser,
  item: { id: string; action: string; payload: unknown; occurredAt: string },
  now: Date,
  translate: (message: string) => string,
  deps: Deps,
): Promise<SyncResult> {
  const reject = (error: string): SyncResult => ({ id: item.id, status: 'rejected', error: translate(error) })

  if (!isOfflineAction(item.action)) return reject('This action cannot be sent from a device.')
  const action: OfflineAction = item.action

  // The instant the device recorded, on this person's clock.
  const instant = new Date(item.occurredAt)
  const occurredAt = zonedNow(user.timeZone, instant)
  const problem = occurredAtProblem(occurredAt, now)
  if (problem) return reject(problem)

  const parsed = OFFLINE_ACTIONS[action].safeParse(item.payload)
  if (!parsed.success) return reject('Some of what was typed is not valid.')

  // Already received: a retry after a lost answer. Done once only.
  if (!(await deps.claim(item.id, user.id, action))) return { id: item.id, status: 'synced' }

  try {
    // Sent from the person's own device: recorded as theirs.
    await withOrigin(null, () => (deps.handlers[action] as Handler<OfflineAction>)(user, parsed.data as never, occurredAt, now, instant))
    return { id: item.id, status: 'synced' }
  } catch (error) {
    await deps.release(item.id, user.id)
    if (isFinanceRuleError(error) || isPersonalRuleError(error)) return reject(error.message)
    console.error('Sync item failed:', error)
    return { id: item.id, status: 'failed' }
  }
}
