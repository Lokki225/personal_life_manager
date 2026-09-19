import { dailySaving, daysInPeriod } from '../../domain/finance/calculations'
import {
  financeRepository,
  type AllocationRepository,
  type BudgetExceptionRepository,
  type ExpenseRepository,
  type IncomeRepository,
  type SavingRepository,
} from '../../infrastructure/repositories/financeRepository'

export type RecomputeFinanceStateInput = {
  userId: string
  referenceDate?: Date
  repository?: Partial<IncomeRepository> &
    Partial<AllocationRepository> &
    Partial<ExpenseRepository> &
    Partial<SavingRepository> &
    Partial<BudgetExceptionRepository>
}

export async function recomputeFinanceState(
  input: RecomputeFinanceStateInput,
  repository: RecomputeFinanceStateInput['repository'] = financeRepository,
): Promise<{
  incomeTotal: number
  allocationTotal: number
  dailyLivingAllocation: number
  expenseTotal: number
  remaining: number
  dailyBudget: number
  periodBudget: number
  dailySpent: number
  dailyRemaining: number
  dailyOverspend: number
  monthlySpent: number
  monthlyRemaining: number
  monthlyOverspend: number
  dailySaving: number
  overspending: number
  actualSavings: number
  buffer: number
  exceptionCount: number
  dailyExpenses: Array<{
    id: string
    amount: number
    category: string
    date: Date
    description?: string | null
  }>
  allocationBreakdown: Array<{ name: string; amount: number; category: string; period: string }>
}> {
  const {
    userId,
    referenceDate = new Date(),
    repository: resolvedRepository = repository ?? financeRepository,
  } = input

  const listIncomes = resolvedRepository.listIncomes ?? financeRepository.listIncomes
  const listAllocations = resolvedRepository.listAllocations ?? financeRepository.listAllocations
  const listExpenses = resolvedRepository.listExpenses ?? financeRepository.listExpenses
  const listSavings = resolvedRepository.listSavings ?? financeRepository.listSavings
  const listBudgetExceptions =
    resolvedRepository.listBudgetExceptions ?? financeRepository.listBudgetExceptions

  const [incomes, allocations, expenses, savings, budgetExceptions] = await Promise.all([
    listIncomes(userId),
    listAllocations(userId),
    listExpenses(userId),
    listSavings(userId),
    listBudgetExceptions(userId),
  ])

  const incomeTotal = incomes.reduce<number>((sum, income) => sum + Number(income.amount || 0), 0)
  const allocationTotal = allocations.reduce<number>(
    (sum, allocation) => sum + Number(allocation.amount || 0),
    0,
  )
  const dailyLivingAllocation = allocations
    .filter((allocation) => {
      const category = String(allocation.category ?? '').toLowerCase()
      const name = String(allocation.name ?? '').toLowerCase()
      return category === 'daily_living' || name.includes('daily living')
    })
    .reduce<number>((sum, allocation) => sum + Number(allocation.amount || 0), 0)

  const expenseTotal = expenses.reduce<number>((sum, expense) => sum + Number(expense.amount || 0), 0)

  const period = allocations.some((allocation) => allocation.period === 'weekly')
    ? 'weekly'
    : 'monthly'

  const currentMonthDays = daysInPeriod(period, referenceDate)
  const dailyBudgetAmount = dailyLivingAllocation > 0 ? dailyLivingAllocation : 0
  const periodBudget = dailyBudgetAmount * currentMonthDays

  const startOfPeriod = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const endOfPeriod = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999)
  const today = new Date(referenceDate)

  const dailyExpenses = expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date ?? new Date())
      return (
        expenseDate.getFullYear() === today.getFullYear() &&
        expenseDate.getMonth() === today.getMonth() &&
        expenseDate.getDate() === today.getDate()
      )
    })
    .map((expense) => ({
      id: String(expense.id),
      amount: Number(expense.amount || 0),
      category: String(expense.category ?? 'other'),
      date: new Date(expense.date ?? new Date()),
      description: expense.description ?? null,
    }))

  const dailySpent = dailyExpenses.reduce<number>((sum, expense) => sum + expense.amount, 0)

  const monthlySpent = expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date ?? new Date())
      return expenseDate >= startOfPeriod && expenseDate <= endOfPeriod
    })
    .reduce<number>((sum, expense) => sum + Number(expense.amount || 0), 0)

  const todayBufferTransfer = savings
    .filter((saving) => {
      const savingDate = new Date(saving.date ?? new Date())
      return (
        saving.destination === 'buffer' &&
        savingDate.getFullYear() === today.getFullYear() &&
        savingDate.getMonth() === today.getMonth() &&
        savingDate.getDate() === today.getDate()
      )
    })
    .reduce<number>((sum, saving) => sum + Number(saving.amount || 0), 0)

  const effectiveDailyRemaining = Math.max(dailyBudgetAmount - dailySpent - todayBufferTransfer, 0)
  const dailyRemaining = effectiveDailyRemaining
  const dailyOverspend = Math.max(dailySpent - dailyBudgetAmount, 0)
  const monthlyRemaining = periodBudget - monthlySpent
  const monthlyOverspend = Math.max(monthlySpent - periodBudget, 0)

  const actualSavings = savings
    .filter((saving) => saving.destination === 'savings')
    .reduce<number>((sum, saving) => sum + Number(saving.amount || 0), 0)

  const buffer = savings
    .filter((saving) => saving.destination === 'buffer')
    .reduce<number>((sum, saving) => sum + Number(saving.amount || 0), 0)

  const allocationBreakdown = allocations.map((allocation) => ({
    name: allocation.name,
    amount: Number(allocation.amount || 0),
    category: allocation.category,
    period: allocation.period,
  }))

  return {
    incomeTotal,
    allocationTotal,
    dailyLivingAllocation,
    expenseTotal,
    remaining: dailyRemaining,
    dailyBudget: dailyBudgetAmount,
    periodBudget,
    dailySpent,
    dailyRemaining,
    dailyOverspend,
    monthlySpent,
    monthlyRemaining,
    monthlyOverspend,
    dailySaving: dailySaving(dailyBudgetAmount, dailySpent + todayBufferTransfer),
    overspending: dailyOverspend,
    actualSavings,
    buffer,
    exceptionCount: budgetExceptions.length,
    dailyExpenses,
    allocationBreakdown,
  }
}
