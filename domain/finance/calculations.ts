export type BudgetPeriod = 'monthly' | 'weekly'

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
