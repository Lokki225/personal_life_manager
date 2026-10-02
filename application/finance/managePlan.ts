import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'

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
  today: Date = new Date(),
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
  update: (id: string, data: { source: string; amount: number; payDay: number }) => Promise<unknown>
}

const defaultIncomeDeps: IncomeDeps = {
  listIncomes: financeRepository.listIncomes,
  update: financeRepository.updateIncome,
}

// Corrects an income of the plan. It counts from the next time that income is
// confirmed: what already arrived this month is not rewritten.
export async function updateIncome(
  userId: string,
  income: { id: string; source: string; amount: number; payDay: number },
  deps: IncomeDeps = defaultIncomeDeps,
): Promise<void> {
  const incomes = await deps.listIncomes(userId)

  // An income that belongs to someone else is reported like a missing one.
  if (!incomes.some((candidate) => candidate.id === income.id)) {
    throw new FinanceRuleError('This income no longer exists.')
  }

  await deps.update(income.id, { source: income.source.trim(), amount: income.amount, payDay: income.payDay })
}
