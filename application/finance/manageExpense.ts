import { expenseOverages } from '../../domain/finance/calculations'
import { chestWithdrawalBlocker, isPaidFromChest } from '../../domain/finance/chests'
import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { createBudgetException } from './createBudgetException'
import { getChestsWithBalances } from './getChestsWithBalances'
import { recomputeFinanceState } from './recomputeFinanceState'
import { now as clockNow } from '../../lib/clock'

type ExpenseRow = {
  id: string
  amount: unknown
  date: Date
  createdAt: Date
  paidFromChestId?: string | null
  paidFromChestName?: string | null
}
type ChestRow = { id: string; name: string; type: string; lockedUntil: Date | null; balance: number }
type ExceptionRow = { id: string; expenseId: string | null }

type ManageExpenseDeps = {
  getToday: (
    userId: string,
    referenceDate: Date,
  ) => Promise<{ dailyBudget: number; savedToday: number; coveredToday: number; uncoveredDay: boolean }>
  listExpenses: (userId: string) => Promise<ExpenseRow[]>
  listExceptions: (userId: string) => Promise<ExceptionRow[]>
  updateExpense: (
    id: string,
    data: { amount: number; category: string; description: string | null },
  ) => Promise<unknown>
  deleteExpense: (id: string) => Promise<unknown>
  createException: (input: Parameters<typeof createBudgetException>[0]) => Promise<unknown>
  updateException: (
    id: string,
    data: { plannedAmount: number; actualAmount: number; difference: number },
  ) => Promise<unknown>
  deleteException: (id: string) => Promise<unknown>
  listChests: (userId: string) => Promise<ChestRow[]>
  updateChestExpense: (id: string, data: { amount: number; category: string; description: string | null }) => Promise<unknown>
}

const defaultDeps: ManageExpenseDeps = {
  getToday: (userId, referenceDate) => recomputeFinanceState({ userId, referenceDate }),
  listExpenses: financeRepository.listExpenses,
  listExceptions: financeRepository.listBudgetExceptions,
  updateExpense: financeRepository.updateExpense,
  deleteExpense: financeRepository.deleteExpense,
  createException: createBudgetException,
  updateException: financeRepository.updateBudgetException,
  deleteException: financeRepository.deleteBudgetException,
  listChests: getChestsWithBalances,
  updateChestExpense: financeRepository.updateChestExpense,
}

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()

// One of the user's own expenses, made today on a day the plan covers. Past
// days are closed (their leftover already went to the Buffer), and a 31st is
// paid out of the chests, which a later change would not put back.
async function changeableExpense(userId: string, id: string, deps: ManageExpenseDeps, today: Date) {
  const [state, expenses] = await Promise.all([deps.getToday(userId, today), deps.listExpenses(userId)])
  const expense = expenses.find((candidate) => candidate.id === id)

  // An expense that belongs to someone else is reported like a missing one.
  if (!expense) {
    throw new FinanceRuleError('This expense no longer exists.')
  }

  if (!sameDay(new Date(expense.date), today)) {
    throw new FinanceRuleError('An expense can only be changed the day it was made.')
  }

  // A chest expense gives its money back exactly; the 31st does not matter.
  if (state.uncoveredDay && !isPaidFromChest(expense)) {
    throw new FinanceRuleError('Expenses of a 31st cannot be changed.')
  }

  return { state, expense }
}

// After today's expenses changed, each one's exception is brought back in
// line: an expense is an exception for the part that went beyond what was
// left when it was made. A cause already given is kept.
async function syncTodayExceptions(
  userId: string,
  state: { dailyBudget: number; savedToday: number; coveredToday: number },
  deps: ManageExpenseDeps,
  today: Date,
) {
  const [expenses, exceptions] = await Promise.all([deps.listExpenses(userId), deps.listExceptions(userId)])
  // Only what was paid from the day's budget can go over it.
  const todays = expenses
    .filter((expense) => sameDay(new Date(expense.date), today) && !isPaidFromChest(expense))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
  const amounts = todays.map((expense) => Number(expense.amount))
  // Measured against the plan's budget: money taken from the Buffer to cover
  // an overspend does not make it any less of an exception.
  const plannedBudget = state.dailyBudget - state.coveredToday
  // Without a daily budget nothing can go over.
  const overages =
    plannedBudget > 0 ? expenseOverages(plannedBudget - state.savedToday, amounts) : amounts.map(() => 0)

  for (const [index, expense] of todays.entries()) {
    const over = overages[index]
    const [linked, ...duplicates] = exceptions.filter((exception) => exception.expenseId === expense.id)
    const figures = { plannedAmount: amounts[index] - over, actualAmount: amounts[index], difference: over }

    for (const exception of over > 0 ? duplicates : [linked, ...duplicates]) {
      if (exception) {
        await deps.deleteException(exception.id)
      }
    }

    if (over > 0 && linked) {
      await deps.updateException(linked.id, figures)
    } else if (over > 0) {
      await deps.createException({
        userId,
        date: today,
        ...figures,
        category: 'other',
        reason: 'Unplanned spending',
        resolution: 'Review next cycle',
        expenseId: expense.id,
      })
    }
  }
}

export async function editExpense(
  userId: string,
  expense: { id: string; amount: number; category: string; description?: string | null },
  deps: ManageExpenseDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const { state, expense: current } = await changeableExpense(userId, expense.id, deps, today)
  const change = { amount: expense.amount, category: expense.category, description: expense.description?.trim() || null }

  if (isPaidFromChest(current)) {
    const extra = expense.amount - Number(current.amount)

    if (extra > 0) {
      const chest = (await deps.listChests(userId)).find((candidate) => candidate.id === current.paidFromChestId)

      if (!chest) {
        throw new FinanceRuleError('The chest that paid for this expense no longer exists.', 'amount')
      }

      const blocker = chestWithdrawalBlocker(chest, extra, today)

      if (blocker) {
        throw new FinanceRuleError(blocker.message, 'amount')
      }
    }

    await deps.updateChestExpense(expense.id, change)
    return
  }

  await deps.updateExpense(expense.id, change)
  await syncTodayExceptions(userId, state, deps, today)
}

export async function removeExpense(
  userId: string,
  id: string,
  deps: ManageExpenseDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const { state } = await changeableExpense(userId, id, deps, today)
  const exceptions = await deps.listExceptions(userId)

  // Its exception goes with it, rather than staying behind with no expense.
  for (const exception of exceptions.filter((candidate) => candidate.expenseId === id)) {
    await deps.deleteException(exception.id)
  }

  await deps.deleteExpense(id)
  await syncTodayExceptions(userId, state, deps, today)
}
