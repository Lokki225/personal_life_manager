import { createChest } from './createChest'
import { createGoal } from './createGoal'
import { GOAL_MEASUREMENTS } from './measurements'
import { recordMovement } from './recordMovement'
import { CURRENCY_CODE } from '../../domain/finance/calculations'

type SavingsGoalDeps = {
  createChest: (userId: string, input: { name: string; type: 'AVAILABLE' }) => Promise<{ id: string }>
  createGoal: typeof createGoal
  record: typeof recordMovement
}

const defaultDeps: SavingsGoalDeps = { createChest, createGoal, record: recordMovement }

// A savings goal is a dedicated chest plus one condition: its balance must
// reach the target. Money already put aside enters as a first contribution.
export async function createSavingsGoal(
  userId: string,
  input: { name: string; targetAmount: number; alreadySaved?: number },
  deps: SavingsGoalDeps = defaultDeps,
) {
  const chest = await deps.createChest(userId, { name: input.name, type: 'AVAILABLE' })

  const goal = await deps.createGoal(userId, {
    name: input.name,
    domain: 'finance',
    logic: 'ALL',
    conditions: [
      {
        measurement: GOAL_MEASUREMENTS.CHEST_BALANCE,
        chestId: chest.id,
        operator: 'GTE',
        targetValue: input.targetAmount,
        unit: CURRENCY_CODE,
      },
    ],
  })

  if (input.alreadySaved && input.alreadySaved > 0) {
    await deps.record({
      userId,
      amount: input.alreadySaved,
      type: 'IN',
      reason: 'GOAL_FUNDING',
      destinationChestId: chest.id,
      relatedGoalId: goal.id,
    })
  }

  return goal
}
