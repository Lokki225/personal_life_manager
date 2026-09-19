import {
  financeRepository,
  type BudgetExceptionRepository,
  type ExpenseRepository,
  type SavingRepository,
} from '../../infrastructure/repositories/financeRepository'

export type HistoryPeriod = 'day' | 'week' | 'month' | 'year'
export type HistoryTypeFilter = 'all' | 'expense' | 'saving' | 'exception'

export type HistoryEvent = {
  id: string
  type: 'expense' | 'saving' | 'exception'
  date: Date
  amount: number
  label: string
  category?: string
  description?: string | null
  destination?: string
  reason?: string | null
  resolution?: string | null
  projectName?: string | null
}

export type GetHistoryInput = {
  userId: string
  period?: HistoryPeriod
  type?: HistoryTypeFilter
  category?: string | null
  referenceDate?: Date
  repository?: ExpenseRepository & SavingRepository & BudgetExceptionRepository
}

export async function getHistory(
  input: GetHistoryInput,
  repository: GetHistoryInput['repository'] = financeRepository,
): Promise<HistoryEvent[]> {
  const {
    userId,
    period = 'month',
    type = 'all',
    category = 'all',
    referenceDate = new Date(),
    repository: resolvedRepository = repository ?? financeRepository,
  } = input

  const [expenses, savings, budgetExceptions] = await Promise.all([
    resolvedRepository.listExpenses(userId),
    resolvedRepository.listSavings(userId),
    resolvedRepository.listBudgetExceptions(userId),
  ])

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
    }))

  const savingEvents = savings
    .filter((saving) => {
      const date = new Date(saving.date ?? new Date())
      return date >= start && date <= end
    })
    .map((saving) => ({
      id: String(saving.id),
      type: 'saving' as const,
      date: new Date(saving.date ?? new Date()),
      amount: Number(saving.amount || 0),
      label: `Saved to ${saving.destination ?? 'savings'}`,
      category: saving.destination ?? 'savings',
      destination: saving.destination,
      description: saving.notes,
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
      amount: Number(exception.difference || 0),
      label: `Exception: ${exception.category ?? 'budget'}`,
      category: exception.category,
      reason: exception.reason,
      resolution: exception.resolution,
    }))

  return [...expenseEvents, ...savingEvents, ...exceptionEvents]
    .filter((event) => {
      if (type !== 'all' && event.type !== type) {
        return false
      }

      if (!category || category === 'all') {
        return true
      }

      return event.category === category
    })
    .sort((left, right) => right.date.getTime() - left.date.getTime())
}
