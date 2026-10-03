import { splitReserveDraw } from '../../domain/finance/calculations'
import { recordChestExpense } from './chestExpense'
import { createBudgetException } from './createBudgetException'
import { recomputeFinanceState } from './recomputeFinanceState'
import { recordExpense } from './recordExpense'
import { recordMovement } from './recordMovement'
import { now as clockNow } from '../../lib/clock'

type RecordDailyExpenseDeps = {
  getToday: (
    userId: string,
    referenceDate: Date,
  ) => Promise<{
    dailyBudget: number
    dailyRemaining: number
    uncoveredDay: boolean
    reserveBudgetLeft: number
    chests: { id: string; name: string; isSystem: boolean; balance: number }[]
  }>
  recordExpense: (input: Parameters<typeof recordExpense>[0]) => Promise<{ id: string }>
  recordMovement: typeof recordMovement
  createException: (input: Parameters<typeof createBudgetException>[0]) => Promise<unknown>
  payFromChest: (input: Parameters<typeof recordChestExpense>[0]) => Promise<void>
}

const defaultDeps: RecordDailyExpenseDeps = {
  getToday: (userId, referenceDate) => recomputeFinanceState({ userId, referenceDate }),
  recordExpense,
  recordMovement,
  createException: createBudgetException,
  payFromChest: (input) => recordChestExpense(input),
}

// Records an expense made today.
//
// An expense larger than what is left of the day's budget is an exception: the
// part that goes over is recorded with its cause, tied to that expense. So a
// day's exceptions always add up to the day's overspend.
//
// On the 31st the plan has no budget, so the part of the expense that fits in
// the day's budget is taken out of the Buffer, then the Base Chest.
export async function recordDailyExpense(
  input: {
    userId: string
    amount: number
    category: string
    description?: string | null
    // Why it went over, when it does.
    cause?: string | null
    reason?: string | null
    // Paid with the money of this chest instead of today's budget.
    chestId?: string | null
  },
  deps: RecordDailyExpenseDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const { userId, amount } = input

  if (input.chestId) {
    await deps.payFromChest({
      userId,
      chestId: input.chestId,
      amount,
      category: input.category,
      description: input.description,
    })
    return
  }

  const state = await deps.getToday(userId, today)

  const expense = await deps.recordExpense({
    userId,
    amount,
    category: input.category,
    description: input.description,
    date: today,
  })

  // Without a daily budget there is nothing to go over.
  const over = state.dailyBudget > 0 ? Math.max(amount - state.dailyRemaining, 0) : 0

  if (over > 0) {
    await deps.createException({
      userId,
      date: today,
      plannedAmount: state.dailyRemaining,
      actualAmount: amount,
      difference: over,
      category: input.cause || 'other',
      reason: input.reason || 'Unplanned spending',
      resolution: 'Review next cycle',
      expenseId: expense.id,
    })
  }

  if (!state.uncoveredDay) {
    return
  }

  const buffer = state.chests.find((chest) => chest.isSystem && chest.name === 'Buffer')
  const base = state.chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')
  const draw = splitReserveDraw(Math.min(amount, state.reserveBudgetLeft), {
    buffer: buffer?.balance ?? 0,
    base: base?.balance ?? 0,
  })

  for (const [chest, drawn] of [
    [buffer, draw.fromBuffer],
    [base, draw.fromBase],
  ] as const) {
    if (chest && drawn > 0) {
      await deps.recordMovement({
        userId,
        amount: drawn,
        type: 'OUT',
        reason: 'EXPENSE',
        sourceChestId: chest.id,
        notes: 'Day 31 spending',
      })
    }
  }
}
