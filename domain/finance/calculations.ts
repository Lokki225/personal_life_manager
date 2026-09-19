export type BudgetPeriod = 'monthly' | 'weekly'

export type FinanceState = {
  incomeTotal: number
  allocationTotal: number
  expenseTotal: number
  remaining: number
  dailyBudget: number
  dailySaving: number
  overspending: number
  actualSavings: number
  buffer: number
  exceptionCount: number
}

export function daysInPeriod(period: BudgetPeriod, referenceDate: Date): number {
  if (period === 'weekly') {
    return 7
  }

  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  return new Date(year, month + 1, 0).getDate()
}

export function dailyBudget(
  allocationAmount: number,
  period: BudgetPeriod,
  referenceDate: Date,
): number {
  const days = daysInPeriod(period, referenceDate)

  if (days <= 0) {
    throw new Error('Period must have at least one day.')
  }

  return allocationAmount / days
}

export function formatCurrency(amount: number): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)

  return `XOF ${formattedAmount}`
}

export function financialState({
  incomeTotal,
  allocationTotal,
  expenseTotal,
  actualSavings = 0,
  buffer = 0,
  exceptionCount = 0,
  period = 'monthly',
  referenceDate = new Date(),
}: {
  incomeTotal: number
  allocationTotal: number
  expenseTotal: number
  actualSavings?: number
  buffer?: number
  exceptionCount?: number
  period?: BudgetPeriod
  referenceDate?: Date
}): FinanceState {
  const dailyBudgetAmount =
    allocationTotal > 0 ? dailyBudget(allocationTotal, period, referenceDate) : 0

  return {
    incomeTotal,
    allocationTotal,
    expenseTotal,
    remaining: remainingAllocation(allocationTotal, expenseTotal),
    dailyBudget: dailyBudgetAmount,
    dailySaving: dailySaving(dailyBudgetAmount, expenseTotal),
    overspending: overspending(expenseTotal, dailyBudgetAmount),
    actualSavings,
    buffer,
    exceptionCount,
  }
}

export function remainingAllocation(
  allocatedAmount: number,
  actualSpending: number,
): number {
  return allocatedAmount - actualSpending
}

export function dailySaving(
  dailyBudgetAmount: number,
  actualSpending: number,
): number {
  return Math.max(dailyBudgetAmount - actualSpending, 0)
}

export function overspending(
  actualSpending: number,
  dailyBudgetAmount: number,
): number {
  return Math.max(actualSpending - dailyBudgetAmount, 0)
}
