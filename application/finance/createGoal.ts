// application/finance/createGoal.ts
import { financeRepository, type CreateGoalConditionData } from '@/infrastructure/repositories/financeRepository'
import { GOAL_MEASUREMENTS } from './measurements'

export type CreateGoalInput = {
  name: string
  domain?: string
  logic?: 'ALL' | 'ANY'
  conditions: CreateGoalConditionData[]
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Goal name is required')
  if (!input.conditions || input.conditions.length === 0) {
    throw new Error('A goal needs at least one condition')
  }

  for (const condition of input.conditions) {
    if (condition.measurement === GOAL_MEASUREMENTS.CHEST_BALANCE && !condition.chestId) {
      throw new Error('A chest_balance condition requires a chestId')
    }
    if (Number(condition.targetValue) < 0) {
      throw new Error('Target value cannot be negative')
    }
  }

  return financeRepository.createGoal(userId, {
    name,
    domain: input.domain ?? 'finance',
    logic: input.logic ?? 'ALL',
    conditions: input.conditions,
  })
}