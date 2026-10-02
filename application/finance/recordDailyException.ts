import { FinanceRuleError } from '../../domain/finance/errors'
import { createBudgetException } from './createBudgetException'
import { recomputeFinanceState } from './recomputeFinanceState'
import { now as clockNow } from '../../lib/clock'

type RecordDailyExceptionDeps = {
  getToday: (userId: string) => Promise<{
    dailyBudget: number
    dailySpent: number
    dailyOverspend: number
    overspendExplained: boolean
  }>
  create: typeof createBudgetException
}

const defaultDeps: RecordDailyExceptionDeps = {
  getToday: (userId) => recomputeFinanceState({ userId }),
  create: createBudgetException,
}

// Explains today's overspend. The amounts come from the recorded expenses,
// never from the form.
export async function recordDailyException(
  input: { userId: string; category: string; reason?: string | null },
  deps: RecordDailyExceptionDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const state = await deps.getToday(input.userId)

  if (state.dailyOverspend <= 0) {
    throw new FinanceRuleError("You are within today's budget, so there is nothing to explain.")
  }

  if (state.overspendExplained) {
    throw new FinanceRuleError("Today's overspend is already explained.")
  }

  await deps.create({
    userId: input.userId,
    date: today,
    plannedAmount: state.dailyBudget,
    actualAmount: state.dailySpent,
    difference: state.dailyOverspend,
    category: input.category,
    reason: input.reason || 'Unplanned spending',
    resolution: 'Review next cycle',
  })
}
