// The shared goal engine (Ressources/goal-completion-mechanism.md), with no
// database: a condition reads points from a source, keeps those in its
// window, reduces them to one number and compares it with a target. Groups
// combine conditions and child groups with ALL or ANY.

export type Point = { at: Date; value: number }

export type GoalWindow =
  | { type: 'ALL_TIME' }
  | { type: 'SINCE_GOAL_START' }
  | { type: 'CALENDAR'; unit: 'day' | 'week' | 'month' | 'year' }
  | { type: 'ROLLING'; days: number }

export type Aggregation = 'LATEST' | 'SUM' | 'COUNT' | 'MAX' | 'MIN' | 'AVG' | 'STREAK' | 'RATIO'
export type Operator = 'GTE' | 'GT' | 'LTE' | 'LT' | 'EQ'
export type Logic = 'ALL' | 'ANY'
export type ConditionRole = 'COMPLETION' | 'HEALTH'

export type GoalCondition = {
  id: string
  source: string
  sourceRef: Record<string, unknown>
  aggregation: Aggregation
  window: GoalWindow
  operator: Operator
  target: number
  unit?: string | null
  floor?: number | null
  stretch?: number | null
}

export type ConditionGroup = {
  id: string
  logic: Logic
  role: ConditionRole
  conditions: GoalCondition[]
  children: ConditionGroup[]
}

// Bounds are inclusive; a missing bound is open.
export type Range = { from?: Date; to?: Date }

// Turns a condition into its raw points. Sources are pure functions over data
// loaded beforehand, so a page with many goals loads each kind of data once.
export type Resolve = (condition: GoalCondition) => Point[]

const DAY_MS = 86_400_000

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// The span a window covers at `now`. A calendar window covers its whole
// period, so something dated later this month already counts in this month.
export function windowRange(window: GoalWindow, now: Date, goalStart: Date): Range {
  switch (window.type) {
    case 'ALL_TIME':
      return {}
    case 'SINCE_GOAL_START':
      return { from: goalStart }
    case 'ROLLING':
      return { from: new Date(now.getTime() - window.days * DAY_MS), to: now }
    case 'CALENDAR': {
      const y = now.getFullYear()
      const m = now.getMonth()
      const d = now.getDate()

      if (window.unit === 'day') {
        return { from: new Date(y, m, d), to: new Date(y, m, d, 23, 59, 59, 999) }
      }
      if (window.unit === 'week') {
        // Weeks start on Monday.
        const monday = d - ((now.getDay() + 6) % 7)
        return { from: new Date(y, m, monday), to: new Date(y, m, monday + 6, 23, 59, 59, 999) }
      }
      if (window.unit === 'month') {
        return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
      }
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) }
    }
  }
}

export const inRange = (points: Point[], range: Range) =>
  points.filter((p) => (!range.from || p.at >= range.from) && (!range.to || p.at <= range.to))

// Consecutive days with at least one point, ending today (or yesterday, so a
// streak is not lost before today's point is in).
function streakDays(points: Point[], now: Date): number {
  const days = new Set(points.map((p) => startOfDay(p.at).getTime()))
  let day = startOfDay(now)

  if (!days.has(day.getTime())) {
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1)
  }

  let streak = 0
  while (days.has(day.getTime())) {
    streak += 1
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1)
  }

  return streak
}

export function aggregate(points: Point[], aggregation: Aggregation, now: Date): number {
  if (points.length === 0) {
    return 0
  }

  const values = points.map((p) => p.value)

  switch (aggregation) {
    case 'LATEST':
      // A stable sort keeps points of the same moment in their given order,
      // so the last one given wins (a running balance's final value).
      return [...points].sort((a, b) => a.at.getTime() - b.at.getTime()).at(-1)!.value
    case 'SUM':
      return values.reduce((sum, v) => sum + v, 0)
    case 'COUNT':
      return points.length
    case 'MAX':
      return Math.max(...values)
    case 'MIN':
      return Math.min(...values)
    case 'AVG':
      return values.reduce((sum, v) => sum + v, 0) / values.length
    case 'RATIO':
      // The share of points that are done (value above zero).
      return values.filter((v) => v > 0).length / values.length
    case 'STREAK':
      return streakDays(points, now)
  }
}

export function compare(operator: Operator, actual: number, target: number): boolean {
  switch (operator) {
    case 'GTE':
      return actual >= target
    case 'GT':
      return actual > target
    case 'LTE':
      return actual <= target
    case 'LT':
      return actual < target
    case 'EQ':
      return actual === target
  }
}

// How far along, from 0 to 1, for a progress bar. A ceiling (stay under) or
// an exact value is either met or not.
export function progress(operator: Operator, actual: number, target: number): number {
  if (operator === 'GTE' || operator === 'GT') {
    return target <= 0 ? 1 : Math.max(0, Math.min(actual / target, 1))
  }

  return compare(operator, actual, target) ? 1 : 0
}

export const combine = (logic: Logic, results: boolean[]) =>
  logic === 'ALL' ? results.every(Boolean) : results.some(Boolean)

export type ConditionResult = {
  condition: GoalCondition
  actual: number
  satisfied: boolean
  progress: number
}

export function evaluateCondition(condition: GoalCondition, resolve: Resolve, now: Date, goalStart: Date): ConditionResult {
  const points = inRange(resolve(condition), windowRange(condition.window, now, goalStart))
  const actual = aggregate(points, condition.aggregation, now)

  return {
    condition,
    actual,
    satisfied: compare(condition.operator, actual, condition.target),
    progress: progress(condition.operator, actual, condition.target),
  }
}

export type GroupResult = { satisfied: boolean; results: ConditionResult[] }

// A group holds when ALL or ANY of its conditions and child groups hold. The
// results of every condition below it come back flat, in tree order.
export function evaluateGroup(group: ConditionGroup, resolve: Resolve, now: Date, goalStart: Date): GroupResult {
  const own = group.conditions.map((c) => evaluateCondition(c, resolve, now, goalStart))
  const children = group.children.map((child) => evaluateGroup(child, resolve, now, goalStart))

  return {
    satisfied: combine(group.logic, [...own.map((r) => r.satisfied), ...children.map((c) => c.satisfied)]),
    results: [...own, ...children.flatMap((c) => c.results)],
  }
}
