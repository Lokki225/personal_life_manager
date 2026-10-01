import { ConditionOperator } from "@/app/generated/prisma/enums"

export function evaluateCondition(operator: ConditionOperator, actual: number, target: number): boolean {
  switch (operator) {
    case 'GTE': return actual >= target
    case 'LTE': return actual <= target
    case 'EQ':  return actual === target
    case 'GT':  return actual > target
    case 'LT':  return actual < target
  }
}

export function evaluateGoalLogic(logic: 'ALL'|'ANY', results: boolean[]): boolean {
  return logic === 'ALL' ? results.every(Boolean) : results.some(Boolean)
}
