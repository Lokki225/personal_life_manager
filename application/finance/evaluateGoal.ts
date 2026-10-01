import { getHistory } from '@/application/finance/getHistory'
import { chestBalance, type MovementForBalance } from '@/domain/finance/chests'
import { evaluateCondition, evaluateGoalLogic } from '@/domain/finance/goal'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

export async function evaluateGoal(goalId: string) {
  const goal = await financeRepository.getGoal(goalId)
  if (!goal) {
    throw new Error(`Goal with ID ${goalId} not found`)
  }

  // Fetch movements ONCE, reuse for every chest_balance condition —
  // don't refetch inside the loop.
  const rawMovements = await financeRepository.listMovements(goal.userId)
  const movements: MovementForBalance[] = rawMovements.map((m) => ({
    sourceChestId: m.sourceChestId,
    destinationChestId: m.destinationChestId,
    amount: Number(m.amount),
  }))

  const conditionResults = []

  for (const condition of goal.conditions) {
    let actual: number

    switch (condition.measurement) {
      case 'chest_balance': {
        if (!condition.chestId) {
          throw new Error(`Condition ${condition.id} is missing a chestId`)
        }
        actual = chestBalance(condition.chestId, movements)
        break
      }

      case 'monthly_deviation_count': {
        const history = await getHistory({
          userId: goal.userId,
          type: 'exception',
          period: 'month',
        })
        const exceptions = history.filter(
            (e): e is Extract<typeof history[number], { type: 'exception' }> => e.type === 'exception'
        )
        actual = exceptions.length
        break
      }

      case 'monthly_deviation_amount': {
        const history = await getHistory({
          userId: goal.userId,
          type: 'exception',
          period: 'month',
        })
        actual = history.reduce((sum, e) => sum + Number(e.amount), 0)
        break
      }

      default:
        throw new Error(`Unsupported goal measurement: ${condition.measurement}`)
    }

    const satisfied = evaluateCondition(condition.operator, actual, Number(condition.targetValue))
    conditionResults.push({ condition, actual, satisfied })
  }

  const satisfied = evaluateGoalLogic(
    goal.logic,
    conditionResults.map((r) => r.satisfied)
  )

  return { satisfied, conditionResults }
}