import { FinanceRuleError } from '../../domain/finance/errors'
import { isExplained } from '../../domain/finance/options'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
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
  listExceptions: (userId: string) => Promise<{ id: string; date: Date; category: string }[]>
  update: (id: string, data: { category: string; reason: string }) => Promise<unknown>
  create: typeof createBudgetException
}

const defaultDeps: RecordDailyExceptionDeps = {
  getToday: (userId) => recomputeFinanceState({ userId }),
  listExceptions: financeRepository.listBudgetExceptions,
  update: financeRepository.updateBudgetException,
  create: createBudgetException,
}

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()

// Explains today's overspend. The amounts come from the recorded expenses,
// never from the form. When the overspend was already recorded without a
// cause, that record gets the cause, so nothing is counted twice.
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

  const waiting = (await deps.listExceptions(input.userId)).filter(
    (exception) => sameDay(new Date(exception.date), today) && !isExplained(exception),
  )
  const reason = input.reason || 'Unplanned spending'

  if (waiting.length > 0) {
    for (const exception of waiting) {
      await deps.update(exception.id, { category: input.category, reason })
    }

    return
  }

  await deps.create({
    userId: input.userId,
    date: today,
    plannedAmount: state.dailyBudget,
    actualAmount: state.dailySpent,
    difference: state.dailyOverspend,
    category: input.category,
    reason,
    resolution: 'Review next cycle',
  })
}
