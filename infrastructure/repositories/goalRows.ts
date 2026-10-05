import type { Condition as ConditionRow, Prisma } from '../../app/generated/prisma/client'
import type { GoalCondition, GoalWindow } from '../../domain/goals/engine'

const textList = (value: unknown): string[] | null => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : null)

// Database rows of the goal engine, turned into the engine's plain types.

export function toGoalCondition(row: ConditionRow): GoalCondition {
  return {
    id: row.id,
    source: row.source,
    sourceRef: (row.sourceRef ?? {}) as Record<string, unknown>,
    aggregation: row.aggregation,
    window: row.window as GoalWindow,
    operator: row.operator,
    target: Number(row.target),
    unit: row.unit,
    floor: row.floor === null ? null : Number(row.floor),
    stretch: row.stretch === null ? null : Number(row.stretch),
    label: row.label,
    level: row.level,
    acceptedValues: textList(row.acceptedValues),
    staleAfterDays: row.staleAfterDays,
  }
}

// The fields to write for a condition.
export function conditionData(condition: Omit<GoalCondition, 'id'>) {
  return {
    source: condition.source,
    sourceRef: condition.sourceRef as Prisma.InputJsonValue,
    aggregation: condition.aggregation,
    window: condition.window as Prisma.InputJsonValue,
    operator: condition.operator,
    target: condition.target,
    unit: condition.unit ?? null,
    floor: condition.floor ?? null,
    stretch: condition.stretch ?? null,
    label: condition.label ?? null,
    level: condition.level ?? 'REQUIRED',
    acceptedValues: condition.acceptedValues ? (condition.acceptedValues as Prisma.InputJsonValue) : undefined,
    staleAfterDays: condition.staleAfterDays ?? null,
  }
}
