import { splitReserveDraw } from '../../domain/finance/calculations'
import { UNEXPLAINED_CAUSE } from '../../domain/finance/options'
import { lateExpenseSplit } from '../../domain/offline/capture'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { createBudgetException } from './createBudgetException'
import { getChestsWithBalances } from './getChestsWithBalances'
import { recordExpense } from './recordExpense'

// Notes of the movements that take back a closed day's leftover.
export const LATE_EXPENSE_NOTE = 'Late expense correction'

type Deps = {
  listMovements: (userId: string) => Promise<{ reason: string; type: string; amount: unknown; date: Date; notes: string | null; destinationChestId: string | null; sourceChestId: string | null }[]>
  listChests: (userId: string) => Promise<{ id: string; name: string; isSystem: boolean; balance: number }[]>
  recordExpense: typeof recordExpense
  createException: typeof createBudgetException
  createMovement: typeof financeRepository.createMovement
}

const defaultDeps: Deps = {
  listMovements: financeRepository.listMovements,
  listChests: getChestsWithBalances,
  recordExpense,
  createException: createBudgetException,
  createMovement: financeRepository.createMovement,
}

const endOf = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
const sameMoment = (a: Date, b: Date) => Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000)

// An expense made on a day that was already closed (sent late from a device's
// outbox). The day's leftover went to the Buffer without it, so the part of
// that leftover it spent is taken back (from the Buffer, or from the Base
// Chest if the Buffer was emptied since); what goes beyond is that day's
// overspend, as if it had been recorded on time.
export async function recordLateExpense(
  input: { userId: string; amount: number; category: string; description?: string | null; cause?: string | null; reason?: string | null; occurredAt: Date },
  deps: Deps = defaultDeps,
) {
  const { userId, amount, occurredAt } = input
  const close = endOf(occurredAt)
  const [movements, chests] = await Promise.all([deps.listMovements(userId), deps.listChests(userId)])
  const buffer = chests.find((chest) => chest.isSystem && chest.name === 'Buffer')
  const base = chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')

  // What the day put in the Buffer when it closed, and what was taken back since.
  const leftover = movements
    .filter((m) => m.reason === 'DAILY_SAVING' && m.type === 'IN' && m.destinationChestId === buffer?.id && !m.notes && sameMoment(new Date(m.date), close))
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const alreadyTakenBack = movements
    .filter((m) => m.notes === LATE_EXPENSE_NOTE && sameMoment(new Date(m.date), close))
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const { takeBack, over } = lateExpenseSplit({ amount, leftover, alreadyTakenBack })

  const expense = await deps.recordExpense({ userId, amount, category: input.category, description: input.description, date: occurredAt })

  if (takeBack > 0) {
    const draw = splitReserveDraw(takeBack, { buffer: Math.max(buffer?.balance ?? 0, 0), base: Math.max(base?.balance ?? 0, 0) })
    // Whatever neither chest still holds comes out of the Buffer anyway.
    const fromBuffer = draw.fromBuffer + (takeBack - draw.fromBuffer - draw.fromBase)
    for (const [chest, drawn] of [
      [buffer, fromBuffer],
      [base, draw.fromBase],
    ] as const) {
      if (chest && drawn > 0) {
        await deps.createMovement(userId, { amount: drawn, type: 'OUT', reason: 'WITHDRAWAL', date: close, sourceChestId: chest.id, notes: LATE_EXPENSE_NOTE })
      }
    }
  }

  if (over > 0) {
    await deps.createException({
      userId,
      date: occurredAt,
      plannedAmount: takeBack,
      actualAmount: amount,
      difference: over,
      category: input.cause || UNEXPLAINED_CAUSE,
      reason: input.reason || 'Unplanned spending',
      resolution: 'Review next cycle',
      expenseId: expense.id,
    })
  }

  return { takeBack, over }
}
