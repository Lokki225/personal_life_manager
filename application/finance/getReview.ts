import {
  ChestRepository,
  DebtRepository,
  financeRepository,
  GoalRepository,
  MovementRepository,
  type AllocationRepository,
  type BudgetExceptionRepository,
  type ExpenseRepository,
  type IncomeRepository,
} from '../../infrastructure/repositories/financeRepository'
import { budgetDaysInPeriod } from '../../domain/finance/calculations'
import { DEBTS_CHEST_NAME } from '../../domain/finance/chests'
import { periodBuckets, runningBalance, sumByBucket } from '../../domain/finance/series'
import { getHistory, type HistoryPeriod } from './getHistory'
import { recomputeFinanceState } from './recomputeFinanceState'
import { now as clockNow } from '../../lib/clock'

export type ReviewCategoryBreakdown = {
  category: string
  total: number
}

export type ReviewGoalStatus = {
  id: string
  name: string
  satisfied: boolean
  borrowed: number
  owed: number
  conditionResults: Array<{ measurement: string; operator: string; target: number; actual: number; satisfied: boolean }>
}

export type GetReviewInput = {
  userId: string
  period?: HistoryPeriod
  referenceDate?: Date
  repository?: Partial<IncomeRepository> &
    Partial<AllocationRepository> &
    Partial<ExpenseRepository> &
    Partial<BudgetExceptionRepository> &
    Partial<ChestRepository> &
    Partial<MovementRepository> &
    Partial<GoalRepository> &
    Partial<DebtRepository>
}

// What the period looked like over time. A week and a month are cut into
// days, a year into months.
export type ReviewTrend = {
  buckets: { start: Date }[]
  spent: number[]
  // The planned spending for one bucket: a day's budget, or a month's.
  budget: number
  // Held in chests, borrowed money aside. Null for days still to come.
  saved: (number | null)[]
}

export type GetReviewResult = {
  period: HistoryPeriod
  referenceDate: Date
  plannedBudget: number
  actualSpent: number
  remaining: number
  actualSavings: number
  buffer: number
  exceptionCount: number
  categoryBreakdown: ReviewCategoryBreakdown[]
  exceptionBreakdown: ReviewCategoryBreakdown[]
  goals: ReviewGoalStatus[]
  // Null for a single day, which has nothing to plot over time.
  trend: ReviewTrend | null
}

export async function getReview(input: GetReviewInput): Promise<GetReviewResult> {
  const { userId, period = 'month', referenceDate = clockNow(), repository = financeRepository } = input

  const readRepository = repository as IncomeRepository &
    AllocationRepository &
    ExpenseRepository &
    BudgetExceptionRepository &
    MovementRepository &
    ChestRepository

  const [state, history, movements, chests] = await Promise.all([
    recomputeFinanceState({ userId, referenceDate, repository: readRepository }),
    getHistory({ userId, period, referenceDate, repository: readRepository }),
    readRepository.listMovements(userId),
    readRepository.listChests(userId),
  ])

  const rangeExpenses = history.filter((event) => event.type === 'expense')
  const categoryMap = new Map<string, number>()

  for (const event of rangeExpenses) {
    const category = event.category ?? 'other'
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + Number(event.amount || 0))
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((left, right) => right.total - left.total)

  const exceptionEvents = history.filter((event) => event.type === 'exception')
  const exceptionMap = new Map<string, number>()

  for (const event of exceptionEvents) {
    const category = event.category ?? 'other'
    exceptionMap.set(category, (exceptionMap.get(category) ?? 0) + Number(event.amount || 0))
  }

  const exceptionBreakdown = Array.from(exceptionMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((left, right) => right.total - left.total)

  let trend: ReviewTrend | null = null

  if (period !== 'day') {
    const buckets = periodBuckets(period, referenceDate)
    const savingsChests = new Set(
      chests.filter((chest) => !(chest.isSystem && chest.name === DEBTS_CHEST_NAME)).map((chest) => chest.id),
    )
    // Each movement as what it adds to, or takes from, the savings chests.
    const savingsChanges = movements.map((movement) => ({
      date: new Date(movement.date),
      amount:
        (savingsChests.has(movement.destinationChestId ?? '') ? Number(movement.amount) : 0) -
        (savingsChests.has(movement.sourceChestId ?? '') ? Number(movement.amount) : 0),
    }))

    trend = {
      buckets,
      spent: sumByBucket(
        buckets,
        rangeExpenses.map((event) => ({ date: event.date, amount: event.amount })),
      ),
      budget:
        period === 'year'
          ? state.periodBudget
          : Math.floor(state.periodBudget / budgetDaysInPeriod('monthly', referenceDate)),
      saved: runningBalance(buckets, savingsChanges, referenceDate),
    }
  }

  return {
    period,
    referenceDate,
    plannedBudget: Number(state.periodBudget || 0),
    actualSpent: Number(state.monthlySpent || 0),
    remaining: Number(state.monthlyRemaining || 0),
    actualSavings: Number(state.actualSavings || 0),
    buffer: Number(state.buffer || 0),
    exceptionCount: Number(state.exceptionCount || 0),
    categoryBreakdown,
    exceptionBreakdown,
    goals: state.goals,
    trend,
  }
}