import { periodBuckets, sumByBucket } from '../../domain/finance/series'
import {
  financeRepository,
  type BudgetExceptionRepository,
  type ExpenseRepository,
  type MovementRepository,
} from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'

export type HistoryPeriod = 'day' | 'week' | 'month' | 'year'
export type HistoryTypeFilter = 'all' | 'expense' | 'exception' | 'movement'

export type HistoryEvent = {
  id: string
  type: 'expense' | 'exception' | 'movement'
  date: Date
  amount: number
  label: string
  category?: string
  description?: string | null
  reason?: string | null
  resolution?: string | null
  projectName?: string | null
  movementType?: 'IN' | 'OUT' | 'TRANSFER'
  // For an expense: the chest that paid for it, when not the day's budget.
  paidFromChest?: string | null
  // Who recorded it, when not the person: "assistant" or "api:<key name>".
  origin?: string | null
  sourceChestName?: string | null
  destinationChestName?: string | null
}

export type GetHistoryInput = {
  userId: string
  period?: HistoryPeriod
  type?: HistoryTypeFilter
  category?: string | null
  referenceDate?: Date
  repository?: Pick<ExpenseRepository, 'listExpenses'> &
    Pick<BudgetExceptionRepository, 'listBudgetExceptions'> &
    Pick<MovementRepository, 'listMovements'>
}

// The amounts of the listed events over the period: per day for a week or a
// month, per month for a year. Null for a single day.
export function historyTrend(
  events: HistoryEvent[],
  period: HistoryPeriod,
  referenceDate: Date = clockNow(),
): { buckets: { start: Date }[]; totals: number[] } | null {
  if (period === 'day') {
    return null
  }

  const buckets = periodBuckets(period, referenceDate)

  return { buckets, totals: sumByBucket(buckets, events) }
}

// "DAILY_SAVING" reads as "Daily saving".
const sentenceCase = (code: string) => {
  const words = code.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export async function getHistory(input: GetHistoryInput): Promise<HistoryEvent[]> {
  const {
    userId,
    period = 'month',
    type = 'all',
    category = 'all',
    referenceDate = clockNow(),
    repository = financeRepository,
  } = input

  const start = new Date(referenceDate)
  const end = new Date(referenceDate)

  if (period === 'day') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'week') {
    const dayOfWeek = start.getDay()
    const diff = (dayOfWeek + 6) % 7
    start.setDate(start.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else if (period === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    end.setMonth(end.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  } else {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)
    end.setFullYear(end.getFullYear() + 1, 0, 0)
    end.setHours(23, 59, 59, 999)
  }

  // Only the period is read from the database.
  const range = { from: start, to: end }
  const [expenses, budgetExceptions, movements] = await Promise.all([
    repository.listExpenses(userId, range),
    repository.listBudgetExceptions(userId, range),
    repository.listMovements(userId, range),
  ])


  const expenseEvents = expenses
    .filter((expense) => {
      const date = new Date(expense.date ?? new Date())
      return date >= start && date <= end
    })
    .map((expense) => ({
      id: String(expense.id),
      type: 'expense' as const,
      date: new Date(expense.date ?? new Date()),
      amount: Number(expense.amount || 0),
      label: expense.description || expense.category || 'Expense',
      category: expense.category,
      description: expense.description,
      projectName: expense.project?.name ?? null,
      paidFromChest: expense.paidFromChestName ?? null,
      origin: expense.origin ?? null,
    }))

  const exceptionEvents = budgetExceptions
    .filter((exception) => {
      const date = new Date(exception.date ?? new Date())
      return date >= start && date <= end
    })
    .map((exception) => ({
      id: String(exception.id),
      type: 'exception' as const,
      date: new Date(exception.date ?? new Date()),
      amount: Math.max(Number(exception.difference || 0), 0),
      label: `Exception: ${exception.category ?? 'budget'}`,
      category: exception.category,
      reason: exception.reason,
      resolution: exception.resolution,
      origin: exception.origin ?? null,
    }))

  const movementEvents = movements
    .filter((movement) => {
      const date = new Date(movement.date)
      // Money a chest paid for an expense shows as that expense.
      return date >= start && date <= end && !movement.expenseId
    })
    .map((movement) => ({
      id: String(movement.id),
      type: 'movement' as const,
      date: new Date(movement.date),
      amount: Number(movement.amount || 0),
      label:
        movement.type === 'TRANSFER'
          ? `Transfer: ${movement.sourceChest?.name ?? '?'} → ${movement.destinationChest?.name ?? '?'}`
          : movement.notes?.trim() || sentenceCase(movement.reason),
      movementType: movement.type,
      sourceChestName: movement.sourceChest?.name ?? null,
      destinationChestName: movement.destinationChest?.name ?? null,
      origin: movement.origin ?? null,
    }))

    const allEvents: HistoryEvent[] = [...expenseEvents, ...exceptionEvents, ...movementEvents]

  return allEvents
    .filter((event) => {
      if (type !== 'all' && event.type !== type) return false
      if (!category || category === 'all') return true
      return event.category === category
    })
    .sort((left, right) => right.date.getTime() - left.date.getTime())
}