// application/finance/fundGoal.ts
import { MovementReason } from '@/app/generated/prisma/enums'
import { FinanceRuleError } from '@/domain/finance/errors'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

import { transferBetweenChests } from './transferBetweenChests'

type FundGoalDeps = {
  getGoal: typeof financeRepository.getGoal
  transfer: typeof transferBetweenChests
}

const defaultDeps: FundGoalDeps = { getGoal: financeRepository.getGoal, transfer: transferBetweenChests }

export async function fundGoal(
  userId: string,
  goalId: string,
  amount: number,
  sourceChestId: string,
  deps: FundGoalDeps = defaultDeps,
) {
  const goal = await deps.getGoal(userId, goalId)

  // A goal that belongs to someone else is reported exactly like a missing one.
  if (!goal || goal.userId !== userId) {
    throw new FinanceRuleError('Choose one of your goals.', 'goalId')
  }

  const chestCondition = goal.conditions.find((c) => c.measurement === 'chest_balance' && c.chestId)
  if (!chestCondition?.chestId) {
    throw new FinanceRuleError('This goal has no chest to fund.', 'goalId')
  }

  await deps.transfer(userId, sourceChestId, chestCondition.chestId, amount, MovementReason.GOAL_FUNDING)
}
