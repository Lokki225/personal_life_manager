import {
  isIncomeDue,
  monthlyAmount,
  receiptDeposits,
  type BudgetPeriod,
} from '../../domain/finance/calculations'
import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'

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
  referenceDate: Date = new Date(),
  deps: Pick<ConfirmIncomeDeps, 'listIncomes' | 'listReceipts'> = defaultDeps,
): Promise<PendingIncome[]> {
  const [incomes, receipts] = await Promise.all([
    deps.listIncomes(userId),
    deps.listReceipts(userId, monthStart(referenceDate)),
  ])
  const confirmed = new Set(receipts.map((receipt) => receipt.incomeId))

  return incomes
    .filter((income) => !confirmed.has(income.id) && isIncomeDue(income.payDay, income.createdAt, referenceDate))
    .map((income) => ({
      id: income.id,
      source: income.source,
      usualAmount: Math.floor(
        monthlyAmount(Number(income.amount || 0), income.frequency === 'weekly' ? 'weekly' : 'monthly', referenceDate),
      ),
    }))
}

// Money only reaches the chests once the user says the income arrived, for
// the amount that really came in: planned savings go to "Monthly Savings" and
// what no allocation claims goes to the Base Chest.
export async function confirmIncome(
  input: { userId: string; incomeId: string; amount: number },
  referenceDate: Date = new Date(),
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
