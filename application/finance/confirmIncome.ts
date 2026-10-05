import {
  isIncomeDue,
  monthlyAmount,
  receiptDeposits,
  type BudgetPeriod,
} from '../../domain/finance/calculations'
import { FinanceRuleError, isFinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'

type ConfirmIncomeDeps = {
  listIncomes: (
    userId: string,
  ) => Promise<{ id: string; source: string; amount: unknown; frequency: string; payDay: number; createdAt: Date }[]>
  listAllocations: (userId: string) => Promise<{ amount: unknown; period: string; category: string }[]>
  listReceipts: (userId: string, periodStart: Date) => Promise<{ incomeId: string }[]>
  confirm: typeof financeRepository.confirmIncomeReceipt
}

const defaultDeps: ConfirmIncomeDeps = {
  listIncomes: financeRepository.listIncomes,
  listAllocations: financeRepository.listAllocations,
  listReceipts: financeRepository.listIncomeReceipts,
  confirm: financeRepository.confirmIncomeReceipt,
}

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const usualAmount = (income: { amount: unknown; frequency: string }, referenceDate: Date) =>
  Math.floor(
    monthlyAmount(Number(income.amount || 0), income.frequency === 'weekly' ? 'weekly' : 'monthly', referenceDate),
  )

export type PendingIncome = {
  id: string
  source: string
  // What usually arrives in a month, offered as the amount to confirm.
  usualAmount: number
}

// The incomes to confirm now: their pay day is reached, at least a month
// after setup, and they are not yet confirmed for the reference month.
export async function listPendingIncomes(
  userId: string,
  referenceDate: Date = clockNow(),
  deps: Pick<ConfirmIncomeDeps, 'listIncomes' | 'listReceipts'> = defaultDeps,
): Promise<PendingIncome[]> {
  const [incomes, receipts] = await Promise.all([
    deps.listIncomes(userId),
    deps.listReceipts(userId, monthStart(referenceDate)),
  ])
  const confirmed = new Set(receipts.map((receipt) => receipt.incomeId))

  return incomes
    .filter((income) => !confirmed.has(income.id) && isIncomeDue(income.payDay, income.createdAt, referenceDate))
    .map((income) => ({ id: income.id, source: income.source, usualAmount: usualAmount(income, referenceDate) }))
}

// The incomes set up this month and not yet placed in the chests. The money
// of the setup month is already in hand, so nobody is asked to confirm it.
export async function listSetupMonthIncomes(
  userId: string,
  referenceDate: Date = clockNow(),
  deps: Pick<ConfirmIncomeDeps, 'listIncomes' | 'listReceipts'> = defaultDeps,
): Promise<{ id: string; usualAmount: number }[]> {
  const [incomes, receipts] = await Promise.all([
    deps.listIncomes(userId),
    deps.listReceipts(userId, monthStart(referenceDate)),
  ])
  const confirmed = new Set(receipts.map((receipt) => receipt.incomeId))

  return incomes
    .filter((income) => !confirmed.has(income.id) && monthStart(income.createdAt).getTime() === monthStart(referenceDate).getTime())
    .map((income) => ({ id: income.id, usualAmount: usualAmount(income, referenceDate) }))
    .filter((income) => income.usualAmount >= 1)
}

// Counts the setup month's income as received: planned savings go to "Monthly
// Savings" and what no allocation claims goes to the Base Chest, so that money
// shows somewhere from the first day. Doing it twice changes nothing.
export async function depositSetupMonth(
  userId: string,
  referenceDate: Date = clockNow(),
  deps: ConfirmIncomeDeps = defaultDeps,
): Promise<number> {
  const incomes = await listSetupMonthIncomes(userId, referenceDate, deps)
  let placed = 0

  for (const income of incomes) {
    try {
      await confirmIncome({ userId, incomeId: income.id, amount: income.usualAmount }, referenceDate, deps)
      placed += 1
    } catch (error) {
      // Another page load got there first: the income is already counted.
      if (!isFinanceRuleError(error)) {
        throw error
      }
    }
  }

  return placed
}

// Money only reaches the chests once the user says the income arrived, for
// the amount that really came in: planned savings go to "Monthly Savings" and
// what no allocation claims goes to the Base Chest.
export async function confirmIncome(
  input: { userId: string; incomeId: string; amount: number },
  referenceDate: Date = clockNow(),
  deps: ConfirmIncomeDeps = defaultDeps,
): Promise<void> {
  const { userId, incomeId, amount } = input
  const [incomes, allocations] = await Promise.all([deps.listIncomes(userId), deps.listAllocations(userId)])

  if (!incomes.some((income) => income.id === incomeId)) {
    throw new FinanceRuleError('This income no longer exists.')
  }

  const plan = allocations.map((allocation) => ({
    amount: Number(allocation.amount || 0),
    period: (allocation.period === 'weekly' ? 'weekly' : 'monthly') as BudgetPeriod,
    category: allocation.category,
  }))

  const confirmed = await deps.confirm(userId, {
    incomeId,
    amount,
    periodStart: monthStart(referenceDate),
    periodEnd: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999),
    receivedAt: referenceDate,
    depositsFor: (receivedBefore) => receiptDeposits(plan, receivedBefore, amount, referenceDate),
  })

  if (!confirmed) {
    throw new FinanceRuleError('This income is already confirmed for this month.')
  }
}

type OneOffDeps = Pick<ConfirmIncomeDeps, 'listAllocations' | 'confirm'> & {
  create: typeof financeRepository.createIncome
}

const defaultOneOffDeps: OneOffDeps = {
  listAllocations: financeRepository.listAllocations,
  confirm: financeRepository.confirmIncomeReceipt,
  create: financeRepository.createIncome,
}

// Money that came once, without being expected (a gift): it is received now,
// so it goes to the chests at once, the same way as a confirmed income. It
// stays out of the monthly plan and is never asked for again.
export async function recordOneOffIncome(
  userId: string,
  input: { source: string; amount: number },
  referenceDate: Date = clockNow(),
  deps: OneOffDeps = defaultOneOffDeps,
): Promise<void> {
  const source = input.source.trim()

  if (!source) throw new FinanceRuleError('Enter an income source.', 'source')
  if (!(input.amount >= 1)) throw new FinanceRuleError('Enter an amount greater than zero.', 'amount')

  const [income, allocations] = await Promise.all([
    deps.create(userId, {
      source,
      amount: input.amount,
      frequency: 'occasional',
      payDay: null,
      status: 'received',
      actualDate: referenceDate,
    }),
    deps.listAllocations(userId),
  ])
  const plan = allocations.map((allocation) => ({
    amount: Number(allocation.amount || 0),
    period: (allocation.period === 'weekly' ? 'weekly' : 'monthly') as BudgetPeriod,
    category: allocation.category,
  }))

  await deps.confirm(userId, {
    incomeId: income.id,
    amount: input.amount,
    periodStart: monthStart(referenceDate),
    periodEnd: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999),
    receivedAt: referenceDate,
    // Planned savings still missing this month come first; the rest goes to the Base Chest.
    depositsFor: (receivedBefore) => receiptDeposits(plan, receivedBefore, input.amount, referenceDate),
  })
}

// Money that came once this month, for the plan's page.
export async function listOneOffIncomes(userId: string, referenceDate: Date = clockNow()) {
  const incomes = await financeRepository.listOneOffIncomes(userId, monthStart(referenceDate))
  return incomes.map((income) => ({
    id: income.id,
    source: income.source,
    amount: Number(income.amount),
    receivedAt: income.actualDate ?? income.createdAt,
  }))
}
