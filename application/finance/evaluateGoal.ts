import { evaluateGroup } from '@/domain/goals/engine'
import { toEngineCondition } from '@/domain/goals/financeGoals'
import { financeResolver, type FinanceEvidence } from '@/domain/goals/financeSources'
import type { GoalRecordWithConditions } from '@/infrastructure/repositories/financeRepository'

// Evaluates a Finance goal with the shared goal engine, from data the caller
// already loaded, so a page with many goals does not go back to the database
// for each one.
export function evaluateGoal(
  goal: Pick<GoalRecordWithConditions, 'logic' | 'conditions'> & { startDate?: Date },
  evidence: FinanceEvidence,
  now: Date,
) {
  const conditions = goal.conditions.map((condition) => ({ ...toEngineCondition(condition), id: condition.id }))
  const result = evaluateGroup(
    { id: 'root', logic: goal.logic, role: 'COMPLETION', conditions, children: [] },
    financeResolver(evidence, now),
    now,
    goal.startDate ?? now,
  )

  return {
    satisfied: result.satisfied,
    conditionResults: result.results.map((r, index) => ({
      condition: goal.conditions[index],
      actual: r.actual,
      satisfied: r.satisfied,
    })),
  }
}
