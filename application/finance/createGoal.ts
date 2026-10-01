// application/finance/createGoal.ts
import { financeRepository, type CreateGoalConditionData } from '@/infrastructure/repositories/financeRepository'
import { FinanceRuleError } from '@/domain/finance/errors'

import { GOAL_MEASUREMENTS } from './measurements'

export type CreateGoalInput = {
  name: string
  domain?: string
  logic?: 'ALL' | 'ANY'
  conditions: CreateGoalConditionData[]
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const name = input.name.trim()
  if (!name) throw new FinanceRuleError('Enter a goal name.', 'name')
  if (!input.conditions || input.conditions.length === 0) {
    throw new FinanceRuleError('Add at least one condition.', 'conditions')
  }

  for (const condition of input.conditions) {
    if (condition.measurement === GOAL_MEASUREMENTS.CHEST_BALANCE && !condition.chestId) {
      throw new FinanceRuleError('A chest balance condition needs a chest.')
    }
    if (Number(condition.targetValue) < 0) {
      throw new FinanceRuleError('A target cannot be negative.')
    }
  }

  return financeRepository.createGoal(userId, {
    name,
    domain: input.domain ?? 'finance',
    logic: input.logic ?? 'ALL',
    conditions: input.conditions,
  })
}