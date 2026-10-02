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

// Where a month's income goes before any spending: what the savings
// allocations set aside, and what no allocation claims.
export function planDeposits(
  plan: {
    incomes: { amount: number; frequency: string }[]
    allocations: { amount: number; period: BudgetPeriod; category: string }[]
  },
  referenceDate: Date,
): { savings: number; unallocated: number } {
  const income = plan.incomes.reduce(
    (total, entry) =>
      total + monthlyAmount(entry.amount, entry.frequency === 'weekly' ? 'weekly' : 'monthly', referenceDate),
    0,
  )
  const monthly = plan.allocations.map((allocation) => ({
    category: allocation.category,
    amount: monthlyAmount(allocation.amount, allocation.period, referenceDate),
  }))
  const allocated = monthly.reduce((total, allocation) => total + allocation.amount, 0)
  const savings = monthly
    .filter((allocation) => allocation.category === 'savings')
    .reduce((total, allocation) => total + allocation.amount, 0)

  // Whole units only, and never more than the income can cover.
  return {
    savings: Math.floor(Math.min(savings, Math.max(income, 0))),
    unallocated: Math.floor(Math.max(income - allocated, 0)),
  }
}

export type PlanChestMove = { kind: 'toSavings' | 'toBase' | 'in' | 'out'; amount: number }

// What to move so the chests match the plan again after it changed.
// `target` is what the plan wants placed this month (savings in the savings
// chest, unallocated income in the Base Chest), `placed` what it already put
// there. Money goes between the two chests first; the rest enters or leaves
// the Base Chest. Nothing is taken from a chest that does not hold it.
export function planChestMoves({
  target,
  placed,
  balances,
  oneChest = false,
}: {
  target: { savings: number; unallocated: number }
  placed: { savings: number; unallocated: number }
  balances: { savings: number; base: number }
  // No savings chest of its own: everything lives in the Base Chest.
  oneChest?: boolean
}): PlanChestMove[] {
  const moves: PlanChestMove[] = []
  const add = (kind: PlanChestMove['kind'], amount: number) => {
    if (Math.floor(amount) >= 1) {
      moves.push({ kind, amount: Math.floor(amount) })
    }
  }

  let baseBalance = Math.max(balances.base, 0)
  let baseChange = 0

  if (oneChest) {
    // `placed.unallocated` already counts everything put in the Base Chest.
    const change = target.savings + target.unallocated - placed.unallocated
    add(change > 0 ? 'in' : 'out', change > 0 ? change : Math.min(-change, baseBalance))

    return moves
  }

  const savingsChange = target.savings - placed.savings

  if (savingsChange > 0) {
    const amount = Math.min(savingsChange, baseBalance)
    add('toSavings', amount)
    baseChange -= amount
  } else if (savingsChange < 0) {
    const amount = Math.min(-savingsChange, Math.max(balances.savings, 0))
    add('toBase', amount)
    baseChange += amount
  }

  baseBalance += baseChange
  const rest = target.unallocated - placed.unallocated - baseChange

  add(rest > 0 ? 'in' : 'out', rest > 0 ? rest : Math.min(-rest, Math.max(baseBalance, 0)))

  return moves
}

// What one confirmed income adds to the chests. The month's receipts are
// counted together, so savings fill up first and only what the allocations
// leave over is unallocated, however the income is split across arrivals.
export function receiptDeposits(
  allocations: { amount: number; period: BudgetPeriod; category: string }[],
  receivedBefore: number,
  amount: number,
  referenceDate: Date,
): { savings: number; unallocated: number } {
  const depositsAt = (received: number) =>
    planDeposits({ incomes: [{ amount: received, frequency: 'monthly' }], allocations }, referenceDate)
  const before = depositsAt(receivedBefore)
  const after = depositsAt(receivedBefore + amount)

  return { savings: after.savings - before.savings, unallocated: after.unallocated - before.unallocated }
}

// The date an income is expected in the reference month. A pay day the month
// does not have (the 31st in June) falls on its last day.
export function incomePayDate(payDay: number, referenceDate: Date): Date {
  const day = Math.min(Math.max(Math.floor(payDay), 1), daysInPeriod('monthly', referenceDate))

  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day)
}

// Whether an income should be confirmed now. Its pay day must be reached, and
// that pay day must be at least a month after the income was set up: the
// money in hand at setup is already counted.
export function isIncomeDue(payDay: number, setUpOn: Date, referenceDate: Date): boolean {
  const expectedOn = incomePayDate(payDay, referenceDate)
  const firstConfirmation = new Date(setUpOn.getFullYear(), setUpOn.getMonth() + 1, setUpOn.getDate())

  return referenceDate >= expectedOn && expectedOn >= firstConfirmation
}

// The 31st: the monthly budget only covers 30 days.
export function isUncoveredDay(referenceDate: Date): boolean {
  return referenceDate.getDate() > MAX_BUDGET_DAYS_IN_MONTH
}

// On an uncovered day the budget comes from the reserves (Buffer and Base
// Chest): a full day's budget when they hold enough, less when they do not,
// nothing when they are empty. `drawnToday` is what the day already took out
// of them, so the budget does not shrink as it is spent.
export function uncoveredDayBudget(dailyBudgetAmount: number, reserves: number, drawnToday: number): number {
  return Math.min(Math.max(dailyBudgetAmount, 0), Math.floor(Math.max(reserves, 0)) + Math.max(drawnToday, 0))
}

// Takes an amount out of the reserves, Buffer first, then the Base Chest.
export function splitReserveDraw(
  amount: number,
  reserves: { buffer: number; base: number },
): { fromBuffer: number; fromBase: number } {
  const fromBuffer = Math.min(Math.max(amount, 0), Math.max(reserves.buffer, 0))
  const fromBase = Math.min(Math.max(amount - fromBuffer, 0), Math.max(reserves.base, 0))

  return { fromBuffer, fromBase }
}

export type InterestType = 'NONE' | 'PERCENT' | 'FIXED'

// What a debt comes to once its interest is added. Interest is flat: a
// percentage of the principal, or a fixed amount, charged once.
export function debtTotal(principal: number, interestType: InterestType, interestValue: number): number {
  if (interestType === 'PERCENT') {
    return Math.round(principal + (principal * interestValue) / 100)
  }

  return interestType === 'FIXED' ? principal + interestValue : principal
}

export function debtOutstanding(total: number, payments: number[]): number {
  return Math.max(total - payments.reduce((sum, payment) => sum + payment, 0), 0)
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
