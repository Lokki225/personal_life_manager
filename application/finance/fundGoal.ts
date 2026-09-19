import {
  financeRepository,
  type FinancialGoalRepository,
  type FinancialGoalRecord,
} from '../../infrastructure/repositories/financeRepository'

export type FundGoalInput = {
  userId: string
  goalId: string
  amount: number | string
}

export async function fundGoal(
  input: FundGoalInput,
  repository: FinancialGoalRepository = financeRepository,
): Promise<FinancialGoalRecord> {
  const goals = await repository.listFinancialGoals(input.userId)
  const goal = goals.find((item) => item.id === input.goalId)

  if (!goal) {
    throw new Error('Goal not found.')
  }

  const nextAmount = Number(goal.currentAmount || 0) + Number(input.amount || 0)

  return repository.updateFinancialGoal(input.goalId, { currentAmount: nextAmount })
}
