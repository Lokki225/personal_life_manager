import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'

type ManagePlanDeps = {
  listAllocations: (userId: string) => Promise<{ id: string }[]>
  create: (
    userId: string,
    data: { name: string; amount: number; period: string; category: string; startDate: Date },
  ) => Promise<unknown>
  update: (id: string, data: { name: string; amount: number; period: string; category: string }) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
}

const defaultDeps: ManagePlanDeps = {
  listAllocations: financeRepository.listAllocations,
  create: financeRepository.createAllocation,
  update: financeRepository.updateAllocation,
  remove: financeRepository.deleteAllocation,
}

const NOT_FOUND = 'This allocation no longer exists.'

async function ownAllocation(userId: string, id: string, deps: ManagePlanDeps) {
  const allocations = await deps.listAllocations(userId)

  // An allocation that belongs to someone else is reported like a missing one.
  if (!allocations.some((allocation) => allocation.id === id)) {
    throw new FinanceRuleError(NOT_FOUND)
  }
}

// Adds an allocation to the plan, or changes one when `id` is given. The
// daily budget follows from today. The caller then brings the chests in line
// with the new plan (see syncPlanToChests).
export async function saveAllocation(
  userId: string,
  allocation: { id?: string | null; name: string; amount: number; period: string; category: string },
  deps: ManagePlanDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const data = {
    name: allocation.name.trim(),
    amount: allocation.amount,
    period: allocation.period,
    category: allocation.category,
  }

  if (!allocation.id) {
    await deps.create(userId, { ...data, startDate: today })
    return
  }

  await ownAllocation(userId, allocation.id, deps)
  await deps.update(allocation.id, data)
}

export async function removeAllocation(userId: string, id: string, deps: ManagePlanDeps = defaultDeps): Promise<void> {
  await ownAllocation(userId, id, deps)
  await deps.remove(id)
}

type IncomeDeps = {
  listIncomes: (userId: string) => Promise<{ id: string }[]>
  create: (
    userId: string,
    data: { source: string; amount: number; frequency: string; payDay: number },
  ) => Promise<unknown>
  update: (id: string, data: { source: string; amount: number; payDay: number }) => Promise<unknown>
  remove: (userId: string, id: string) => Promise<unknown>
}

const defaultIncomeDeps: IncomeDeps = {
  listIncomes: financeRepository.listIncomes,
  create: financeRepository.createIncome,
  update: financeRepository.updateIncome,
  remove: financeRepository.removeIncome,
}

const INCOME_NOT_FOUND = 'This income no longer exists.'

// Adds an income to the plan, or corrects one when `id` is given.
//
// A new income counts as received for the month it is added in, like the
// income of the setup month. A corrected one counts from the next time it is
// confirmed: what already arrived this month is not rewritten.
export async function saveIncome(
  userId: string,
  income: { id?: string | null; source: string; amount: number; payDay: number },
  deps: IncomeDeps = defaultIncomeDeps,
): Promise<void> {
  const data = { source: income.source.trim(), amount: income.amount, payDay: income.payDay }

  if (!income.id) {
    await deps.create(userId, { ...data, frequency: 'monthly' })
    return
  }

  const incomes = await deps.listIncomes(userId)

  // An income that belongs to someone else is reported like a missing one.
  if (!incomes.some((candidate) => candidate.id === income.id)) {
    throw new FinanceRuleError(INCOME_NOT_FOUND)
  }

  await deps.update(income.id, data)
}

// Removes an income from the plan. One always stays: a plan without any
// income has nothing to spread.
export async function removeIncome(userId: string, id: string, deps: IncomeDeps = defaultIncomeDeps): Promise<void> {
  const incomes = await deps.listIncomes(userId)

  if (!incomes.some((candidate) => candidate.id === id)) {
    throw new FinanceRuleError(INCOME_NOT_FOUND)
  }

  if (incomes.length <= 1) {
    throw new FinanceRuleError('Your plan needs at least one income.')
  }

  await deps.remove(userId, id)
}
