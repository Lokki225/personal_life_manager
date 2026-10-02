import { FinanceRuleError } from '../../domain/finance/errors'
import {
  financeRepository,
  type SetupPlanRepository,
} from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'

export type SetupPlanInput = {
  incomeSource: string
  incomeAmount: number
  incomeFrequency: string
  incomePayDay: number
  allocations: { name: string; amount: number; period: string; category: string }[]
}

// Setup is the one-time starting point: a principal income and the first
// allocations. A user who already has an income is past it.
export async function hasSetupPlan(
  userId: string,
  repository: Pick<SetupPlanRepository, 'hasIncome' | 'createInitialPlan'> = financeRepository,
): Promise<boolean> {
  return repository.hasIncome(userId)
}

export async function createSetupPlan(
  userId: string,
  plan: SetupPlanInput,
  repository: Pick<SetupPlanRepository, 'hasIncome' | 'createInitialPlan'> = financeRepository,
  today: Date = clockNow(),
): Promise<void> {
  const created = await repository.createInitialPlan(userId, {
    income: {
      source: plan.incomeSource,
      amount: plan.incomeAmount,
      frequency: plan.incomeFrequency,
      payDay: plan.incomePayDay,
    },
    allocations: plan.allocations,
    startDate: today,
  })

  if (!created) {
    throw new FinanceRuleError('Your plan is already set up. Nothing was saved again.')
  }
}
