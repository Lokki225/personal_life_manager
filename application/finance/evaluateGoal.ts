import { chestBalance, type MovementForBalance } from '@/domain/finance/chests'
import { evaluateCondition, evaluateGoalLogic } from '@/domain/finance/goal'
import type { GoalRecordWithConditions } from '@/infrastructure/repositories/financeRepository'

// Evaluates a goal from data the caller already loaded, so a page with many
// goals does not go back to the database for each one.
export function evaluateGoal(
  goal: GoalRecordWithConditions,
  data: {
    movements: MovementForBalance[]
    // The `difference` of each exception recorded in the current month.
    monthExceptionAmounts: number[]
  },
) {
  const conditionResults = goal.conditions.map((condition) => {
    let actual: number

    switch (condition.measurement) {
      case 'chest_balance': {
        if (!condition.chestId) {
          throw new Error(`Condition ${condition.id} is missing a chestId`)
        }
        actual = chestBalance(condition.chestId, data.movements)
        break
      }

      case 'monthly_deviation_count': {
        actual = data.monthExceptionAmounts.length
        break
      }

      case 'monthly_deviation_amount': {
        actual = data.monthExceptionAmounts.reduce((sum, amount) => sum + amount, 0)
        break
      }

      default:
        throw new Error(`Unsupported goal measurement: ${condition.measurement}`)
    }

    const satisfied = evaluateCondition(condition.operator, actual, Number(condition.targetValue))
    return { condition, actual, satisfied }
  })

  const satisfied = evaluateGoalLogic(
    goal.logic,
    conditionResults.map((r) => r.satisfied),
  )

  return { satisfied, conditionResults }
}
