import {
  financeRepository,
  type CreateFinancialGoalData,
  type FinancialGoalRepository,
  type FinancialGoalRecord,
} from '../../infrastructure/repositories/financeRepository'

export type CreateFinancialGoalInput = {
  userId: string
  name: string
  targetAmount: number | string
  currentAmount?: number | string
}

export async function createFinancialGoal(
  input: CreateFinancialGoalInput,
  repository: FinancialGoalRepository = financeRepository,
): Promise<FinancialGoalRecord> {
  const { userId, ...rest } = input

  const payload: CreateFinancialGoalData = {
    name: rest.name,
    targetAmount: rest.targetAmount,
    currentAmount: rest.currentAmount ?? 0,
  }

  return repository.createFinancialGoal(userId, payload)
}
