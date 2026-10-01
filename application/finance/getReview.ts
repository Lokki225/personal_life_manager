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
import { getHistory, type HistoryPeriod } from './getHistory'
import { recomputeFinanceState } from './recomputeFinanceState'

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
}

export async function getReview(input: GetReviewInput): Promise<GetReviewResult> {
  const { userId, period = 'month', referenceDate = new Date(), repository = financeRepository } = input

  const readRepository = repository as IncomeRepository &
    AllocationRepository &
    ExpenseRepository &
    BudgetExceptionRepository &
    MovementRepository

  const [state, history] = await Promise.all([
    recomputeFinanceState({ userId, referenceDate, repository: readRepository }),
    getHistory({ userId, period, referenceDate, repository: readRepository }),
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
  }
}