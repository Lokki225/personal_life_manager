export type BudgetPeriod = 'monthly' | 'weekly'

export const CURRENCY_CODE = 'XOF'

export const MAX_BUDGET_DAYS_IN_MONTH = 30

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

// A monthly budget is spread over at most 30 days, so a 31-day month keeps
// the same daily amount as a 30-day one and its last day is left uncovered.
export function budgetDaysInPeriod(period: BudgetPeriod, referenceDate: Date): number {
  return Math.min(daysInPeriod(period, referenceDate), MAX_BUDGET_DAYS_IN_MONTH)
}

export function dailyBudget(
  allocationAmount: number,
  period: BudgetPeriod,
  referenceDate: Date,
): number {
  const days = budgetDaysInPeriod(period, referenceDate)

  if (days <= 0) {
    throw new Error('Period must have at least one day.')
  }

  return allocationAmount / days
}

export function dailyLivingBudget(
  allocations: { amount: number; period: BudgetPeriod; category: string }[],
  referenceDate: Date,
): number {
  const total = allocations
    .filter((allocation) => allocation.category === 'daily_living')
    .reduce(
      (sum, allocation) => sum + dailyBudget(allocation.amount, allocation.period, referenceDate),
      0,
    )

  // Whole units only: XOF has no minor unit, and a fraction could never be spent or saved.
  return Math.floor(total)
}

// An allocation's amount over a whole month, whatever its period.
export function monthlyAmount(amount: number, period: BudgetPeriod, referenceDate: Date): number {
  return period === 'weekly' ? (amount / 7) * daysInPeriod('monthly', referenceDate) : amount
}

// What the daily-living allocations give for the whole month. A monthly
// allocation counts once; a weekly one is spread over the month's real length.
export function monthlyLivingBudget(
  allocations: { amount: number; period: BudgetPeriod; category: string }[],
  referenceDate: Date,
): number {
  return allocations
    .filter((allocation) => allocation.category === 'daily_living')
    .reduce(
      (total, allocation) => total + monthlyAmount(allocation.amount, allocation.period, referenceDate),
      0,
    )
}

// How much of the month's budget should be used by the end of the reference
// day when spending evenly. Used to tell "ahead" from "behind".
export function expectedSpendToDate(monthBudget: number, referenceDate: Date): number {
  const budgetDays = budgetDaysInPeriod('monthly', referenceDate)

  return (monthBudget * Math.min(referenceDate.getDate(), budgetDays)) / budgetDays
}

// Whole units only: XOF has no minor unit.
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0,
  )
}

export function formatCurrency(amount: number): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)

  return `${CURRENCY_CODE} ${formattedAmount}`
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

export type DailyFinanceStatus = {
  label: 'Safe' | 'Caution' | 'Overspent'
  tone: 'emerald' | 'amber' | 'rose'
  message: string
}

export function getDailyFinanceStatus(
  dailyBudgetAmount: number,
  actualSpending: number,
): DailyFinanceStatus {
  const remaining = dailyBudgetAmount - actualSpending

  if (remaining < 0) {
    return {
      label: 'Overspent',
      tone: 'rose',
      message: `You are over your daily budget by ${formatCurrency(Math.abs(remaining))}.`,
    }
  }

  if (actualSpending >= dailyBudgetAmount * 0.9 && dailyBudgetAmount > 0) {
    return {
      label: 'Caution',
      tone: 'amber',
      message: `You are close to today’s budget. ${formatCurrency(remaining)} remains.`,
    }
  }

  return {
    label: 'Safe',
    tone: 'emerald',
    message: `You can still save ${formatCurrency(remaining)} today.`,
  }
}
