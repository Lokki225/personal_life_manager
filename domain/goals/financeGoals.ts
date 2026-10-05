import type { GoalCondition, GoalWindow, Operator } from './engine'

// Finance describes a goal condition by a named measurement ("chest_balance").
// The engine stores it as source + aggregation + window. These functions
// translate one into the other (mechanism doc §6, migration table), so the
// Finance pages, the API and the assistant keep their vocabulary.

export const GOAL_MEASUREMENTS = {
  // The balance of one chest.
  CHEST_BALANCE: 'chest_balance',
  // Budget exceptions this month: how many, and how far over they went.
  MONTHLY_DEVIATION_COUNT: 'monthly_deviation_count',
  MONTHLY_DEVIATION_AMOUNT: 'monthly_deviation_amount',
  // What the budget paid for this month, in all or in one category.
  MONTHLY_SPENDING: 'monthly_spending',
  MONTHLY_CATEGORY_SPENDING: 'monthly_category_spending',
  // Money put into savings this month (daily and planned savings).
  MONTHLY_SAVED: 'monthly_saved',
  // Everything saved outside the Buffer, borrowed money excluded.
  TOTAL_SAVINGS: 'total_savings',
  // What is still owed on borrowed money.
  DEBT_OWED: 'debt_owed',
} as const

export type GoalMeasurement = (typeof GOAL_MEASUREMENTS)[keyof typeof GOAL_MEASUREMENTS]

// Measurements that start again every month, so a goal using one never ends.
const MONTHLY: GoalMeasurement[] = [
  GOAL_MEASUREMENTS.MONTHLY_DEVIATION_COUNT,
  GOAL_MEASUREMENTS.MONTHLY_DEVIATION_AMOUNT,
  GOAL_MEASUREMENTS.MONTHLY_SPENDING,
  GOAL_MEASUREMENTS.MONTHLY_CATEGORY_SPENDING,
  GOAL_MEASUREMENTS.MONTHLY_SAVED,
]

// Measurements a goal wants to keep low; the others aim up.
const AIMS_DOWN: GoalMeasurement[] = [
  GOAL_MEASUREMENTS.MONTHLY_DEVIATION_COUNT,
  GOAL_MEASUREMENTS.MONTHLY_DEVIATION_AMOUNT,
  GOAL_MEASUREMENTS.MONTHLY_SPENDING,
  GOAL_MEASUREMENTS.MONTHLY_CATEGORY_SPENDING,
  GOAL_MEASUREMENTS.DEBT_OWED,
]

export const aimsDown = (measurement: string) => AIMS_DOWN.includes(measurement as GoalMeasurement)

// A count has no currency; every other measurement is an amount.
export const isAmount = (measurement: string) => measurement !== GOAL_MEASUREMENTS.MONTHLY_DEVIATION_COUNT

export type FinanceCondition = {
  id: string
  measurement: GoalMeasurement
  // The chest of a chest balance.
  chestId: string | null
  // The expense category of a category spending.
  category: string | null
  // Finance compares amounts and counts only.
  operator: Exclude<Operator, 'IN'>
  targetValue: number
  unit: string | null
}

type FinanceConditionInput = Omit<FinanceCondition, 'id' | 'category'> & { id?: string; category?: string | null }

const ALL_TIME: GoalWindow = { type: 'ALL_TIME' }
const THIS_MONTH: GoalWindow = { type: 'CALENDAR', unit: 'month' }

// Each measurement as the engine stores it.
const DEFINITIONS: Record<GoalMeasurement, Pick<GoalCondition, 'source' | 'aggregation' | 'window'>> = {
  chest_balance: { source: 'CHEST_BALANCE', aggregation: 'LATEST', window: ALL_TIME },
  monthly_deviation_count: { source: 'BUDGET_EXCEPTIONS', aggregation: 'COUNT', window: THIS_MONTH },
  monthly_deviation_amount: { source: 'BUDGET_EXCEPTIONS', aggregation: 'SUM', window: THIS_MONTH },
  monthly_spending: { source: 'BUDGET_SPENDING', aggregation: 'SUM', window: THIS_MONTH },
  monthly_category_spending: { source: 'BUDGET_SPENDING', aggregation: 'SUM', window: THIS_MONTH },
  monthly_saved: { source: 'SAVINGS_IN', aggregation: 'SUM', window: THIS_MONTH },
  total_savings: { source: 'SAVINGS_TOTAL', aggregation: 'LATEST', window: ALL_TIME },
  debt_owed: { source: 'DEBT_OWED', aggregation: 'LATEST', window: ALL_TIME },
}

function sourceRefOf(condition: FinanceConditionInput): Record<string, unknown> {
  if (condition.measurement === GOAL_MEASUREMENTS.CHEST_BALANCE) return { chestId: condition.chestId }
  if (condition.measurement === GOAL_MEASUREMENTS.MONTHLY_CATEGORY_SPENDING) return { category: condition.category ?? null }
  return {}
}

export function toEngineCondition(condition: FinanceConditionInput): Omit<GoalCondition, 'id'> & { id?: string } {
  return {
    id: condition.id,
    ...DEFINITIONS[condition.measurement],
    sourceRef: sourceRefOf(condition),
    operator: condition.operator,
    target: condition.targetValue,
    unit: condition.unit,
  }
}

const sameWindow = (a: GoalWindow, b: GoalWindow) => JSON.stringify(a) === JSON.stringify(b)

// The Finance measurement a condition stands for, or null when it is not one
// Finance knows (a condition of another node).
export function measurementOf(
  condition: Pick<GoalCondition, 'source' | 'aggregation' | 'window'> & { sourceRef?: Record<string, unknown> },
): GoalMeasurement | null {
  const matches = (Object.keys(DEFINITIONS) as GoalMeasurement[]).filter((measurement) => {
    const definition = DEFINITIONS[measurement]
    return (
      definition.source === condition.source &&
      definition.aggregation === condition.aggregation &&
      sameWindow(definition.window, condition.window)
    )
  })

  // Spending in all, or in one category, differ only by the category.
  if (matches.includes(GOAL_MEASUREMENTS.MONTHLY_SPENDING)) {
    return typeof condition.sourceRef?.category === 'string'
      ? GOAL_MEASUREMENTS.MONTHLY_CATEGORY_SPENDING
      : GOAL_MEASUREMENTS.MONTHLY_SPENDING
  }

  return matches[0] ?? null
}

export function toFinanceCondition(condition: GoalCondition): FinanceCondition {
  const measurement = measurementOf(condition)

  if (!measurement || condition.operator === 'IN') {
    throw new Error(`Condition ${condition.id} is not a Finance measurement`)
  }

  const { chestId, category } = condition.sourceRef

  return {
    id: condition.id,
    measurement,
    chestId: typeof chestId === 'string' ? chestId : null,
    category: typeof category === 'string' ? category : null,
    operator: condition.operator,
    targetValue: condition.target,
    unit: condition.unit ?? null,
  }
}

// A goal measured month by month never ends: it holds or not each month.
export const lifecycleFor = (conditions: { measurement: GoalMeasurement }[]) =>
  conditions.some((c) => MONTHLY.includes(c.measurement)) ? ('ONGOING' as const) : ('TERMINAL' as const)
