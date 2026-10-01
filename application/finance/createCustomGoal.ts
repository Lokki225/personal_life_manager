import { CURRENCY_CODE } from '../../domain/finance/calculations'
import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { createGoal } from './createGoal'
import { GOAL_MEASUREMENTS, type GoalMeasurement } from './measurements'

export type CustomGoalCondition = {
  measurement: GoalMeasurement
  operator: 'GTE' | 'LTE' | 'EQ' | 'GT' | 'LT'
  targetValue: number
  chestId?: string | null
}

type CustomGoalDeps = {
  listChests: (userId: string) => Promise<{ id: string }[]>
  createGoal: typeof createGoal
}

const defaultDeps: CustomGoalDeps = { listChests: financeRepository.listChests, createGoal }

// A goal built from several conditions, combined with ALL or ANY.
// Errors name the form field of the condition they belong to.
export async function createCustomGoal(
  userId: string,
  input: { name: string; logic: 'ALL' | 'ANY'; conditions: CustomGoalCondition[] },
  deps: CustomGoalDeps = defaultDeps,
) {
  const ownChestIds = new Set((await deps.listChests(userId)).map((chest) => chest.id))

  const conditions = input.conditions.map((condition, index) => {
    const onChest = condition.measurement === GOAL_MEASUREMENTS.CHEST_BALANCE

    if (onChest && (!condition.chestId || !ownChestIds.has(condition.chestId))) {
      throw new FinanceRuleError('Choose one of your chests.', `conditions.${index}.chestId`)
    }

    return {
      measurement: condition.measurement,
      operator: condition.operator,
      targetValue: condition.targetValue,
      chestId: onChest ? condition.chestId : null,
      // A count of exceptions has no currency.
      unit: condition.measurement === GOAL_MEASUREMENTS.MONTHLY_DEVIATION_COUNT ? null : CURRENCY_CODE,
      period: onChest ? ('NONE' as const) : ('MONTHLY' as const),
    }
  })

  return deps.createGoal(userId, { name: input.name, domain: 'finance', logic: input.logic, conditions })
}
