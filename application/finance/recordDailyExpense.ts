import { splitReserveDraw } from '../../domain/finance/calculations'
import { recomputeFinanceState } from './recomputeFinanceState'
import { recordExpense } from './recordExpense'
import { recordMovement } from './recordMovement'

type RecordDailyExpenseDeps = {
  getToday: (
    userId: string,
    referenceDate: Date,
  ) => Promise<{
    uncoveredDay: boolean
    reserveBudgetLeft: number
    chests: { id: string; name: string; isSystem: boolean; balance: number }[]
  }>
  recordExpense: typeof recordExpense
  recordMovement: typeof recordMovement
}

const defaultDeps: RecordDailyExpenseDeps = {
  getToday: (userId, referenceDate) => recomputeFinanceState({ userId, referenceDate }),
  recordExpense,
  recordMovement,
}

// Records an expense made today. On the 31st the plan has no budget, so the
// part of the expense that fits in the day's budget is taken out of the
// Buffer, then the Base Chest.
export async function recordDailyExpense(
  input: { userId: string; amount: number; category: string; description?: string | null },
  deps: RecordDailyExpenseDeps = defaultDeps,
  today: Date = new Date(),
): Promise<void> {
  const { userId, amount } = input
  const state = await deps.getToday(userId, today)

  await deps.recordExpense({ userId, amount, category: input.category, description: input.description, date: today })

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
