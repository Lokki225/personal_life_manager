// The shared goal engine (Ressources/goal-completion-mechanism.md), with no
// database: a condition reads points from a source, keeps those in its
// window, reduces them to one number and compares it with a target. Groups
// combine their required conditions and child groups with ALL or ANY.
//
// A condition's result is MET, EXCEEDS, GAP or UNKNOWN (mechanism §4.1), and
// may be due for review when what it rests on is old. It is evaluated against
// a subject: the person's own situation (SELF) or an alternative, such as a
// Career opportunity, side by side.

export type Point = { at: Date; value: number }

export type GoalWindow =
  | { type: 'ALL_TIME' }
  | { type: 'SINCE_GOAL_START' }
  | { type: 'CALENDAR'; unit: 'day' | 'week' | 'month' | 'year' }
  | { type: 'ROLLING'; days: number }

export type Aggregation = 'LATEST' | 'SUM' | 'COUNT' | 'MAX' | 'MIN' | 'AVG' | 'STREAK' | 'RATIO'
// IN compares a text value with the accepted ones ("remote or hybrid").
export type Operator = 'GTE' | 'GT' | 'LTE' | 'LT' | 'EQ' | 'IN'
export type Logic = 'ALL' | 'ANY'
export type ConditionRole = 'COMPLETION' | 'HEALTH'
// Required conditions decide achievement; preferred ones are counted but never
// block it; info ones are only shown.
export type Level = 'REQUIRED' | 'PREFERRED' | 'INFO'
export type Result = 'MET' | 'EXCEEDS' | 'GAP' | 'UNKNOWN'

export type Subject = { type: 'SELF' } | { type: 'OPPORTUNITY'; id: string }
export const SELF: Subject = { type: 'SELF' }

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
  // Optional, for conditions that need them; absent means the old behavior.
  label?: string | null
  level?: Level
  acceptedValues?: string[] | null
  staleAfterDays?: number | null
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

// What a source says about a condition, when it has more to say than points.
export type SourceAnswer = {
  points: Point[]
  // What no points mean: nothing yet (zero), or not known.
  emptyMeans: 'zero' | 'unknown'
  // For an IN condition: the text value, null when not known.
  text?: string | null
  // Where the value comes from, e.g. "Current position: RPA Developer at Acme".
  describe?: string | null
  // When what the value rests on was last given or checked.
  asOf?: Date | null
  // The source's own freshness rule; the condition's staleAfterDays wins.
  staleAfterDays?: number | null
}

// Turns a condition into its raw points, for a subject. Sources are pure
// functions over data loaded beforehand, so a page with many goals loads each
// kind of data once. Points alone mean that nothing is zero.
export type Resolve = (condition: GoalCondition, subject: Subject) => Point[] | SourceAnswer

const answerOf = (resolved: Point[] | SourceAnswer): SourceAnswer =>
  Array.isArray(resolved) ? { points: resolved, emptyMeans: 'zero' } : resolved

// A condition's raw points, whatever form its source answers in.
export const pointsOf = (resolve: Resolve, condition: GoalCondition, subject: Subject = SELF): Point[] =>
  answerOf(resolve(condition, subject)).points

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

export function compare(operator: Exclude<Operator, 'IN'>, actual: number, target: number): boolean {
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
  if (operator === 'IN') return 0

  return compare(operator, actual, target) ? 1 : 0
}

// Beyond the target in the wanted direction. Only "at least" and "at most"
// can be exceeded: a strict condition is simply met.
const exceeds = (operator: Operator, actual: number, target: number) =>
  (operator === 'GTE' && actual > target) || (operator === 'LTE' && actual < target)

const DAY = 86_400_000

export const combine = (logic: Logic, results: boolean[]) =>
  logic === 'ALL' ? results.every(Boolean) : results.some(Boolean)

export type ConditionResult = {
  condition: GoalCondition
  // The number compared (0 when unknown or a text value).
  actual: number
  // The value as shown: a number, a text, or null when unknown.
  value: number | string | null
  result: Result
  // MET or EXCEEDS.
  satisfied: boolean
  // A result exists, but what it rests on is older than the freshness rule.
  reviewDue: boolean
  describe: string | null
  asOf: Date | null
  progress: number
}

export const levelOf = (condition: GoalCondition): Level => condition.level ?? 'REQUIRED'

export function evaluateCondition(
  condition: GoalCondition,
  resolve: Resolve,
  now: Date,
  goalStart: Date,
  subject: Subject = SELF,
): ConditionResult {
  const answer = answerOf(resolve(condition, subject))
  const staleDays = condition.staleAfterDays ?? answer.staleAfterDays ?? null
  const asOf = answer.asOf ?? null
  const base = { condition, describe: answer.describe ?? null, asOf }

  const unknown = (): ConditionResult => ({ ...base, actual: 0, value: null, result: 'UNKNOWN', satisfied: false, reviewDue: false, progress: 0 })
  const known = (result: Result, actual: number, value: number | string, progressValue: number): ConditionResult => ({
    ...base,
    actual,
    value,
    result,
    satisfied: result === 'MET' || result === 'EXCEEDS',
    reviewDue: staleDays !== null && asOf !== null && now.getTime() - asOf.getTime() > staleDays * DAY,
    progress: progressValue,
  })

  if (condition.operator === 'IN') {
    const text = answer.text ?? null
    if (text === null) return unknown()
    const accepted = (condition.acceptedValues ?? []).map((v) => v.toLowerCase())
    return known(accepted.includes(text.toLowerCase()) ? 'MET' : 'GAP', 0, text, accepted.includes(text.toLowerCase()) ? 1 : 0)
  }

  const points = inRange(answer.points, windowRange(condition.window, now, goalStart))
  if (points.length === 0 && answer.emptyMeans === 'unknown') return unknown()

  const actual = aggregate(points, condition.aggregation, now)
  const met = compare(condition.operator, actual, condition.target)
  const result: Result = !met ? 'GAP' : exceeds(condition.operator, actual, condition.target) ? 'EXCEEDS' : 'MET'
  return known(result, actual, actual, progress(condition.operator, actual, condition.target))
}

export type GroupResult = { satisfied: boolean; results: ConditionResult[] }

// A group holds when ALL or ANY of its required conditions and child groups
// hold; an unknown one does not hold. Preferred and info conditions are
// evaluated and listed, never combined. The results of every condition below
// the group come back flat, in tree order.
export function evaluateGroup(group: ConditionGroup, resolve: Resolve, now: Date, goalStart: Date, subject: Subject = SELF): GroupResult {
  const own = group.conditions.map((c) => evaluateCondition(c, resolve, now, goalStart, subject))
  const children = group.children.map((child) => evaluateGroup(child, resolve, now, goalStart, subject))
  const required = own.filter((r) => levelOf(r.condition) === 'REQUIRED')
  // A group of only preferred or info conditions decides nothing.
  const decides = required.length > 0 || children.length > 0 || own.length === 0

  return {
    satisfied: decides && combine(group.logic, [...required.map((r) => r.satisfied), ...children.map((c) => c.satisfied)]),
    results: [...own, ...children.flatMap((c) => c.results)],
  }
}

export type LevelCounts = { met: number; exceeds: number; gap: number; unknown: number; reviewDue: number }
export type Summary = { required: LevelCounts; preferred: LevelCounts; info: number }

const noCounts = (): LevelCounts => ({ met: 0, exceeds: 0, gap: 0, unknown: 0, reviewDue: 0 })

// Counts per level, never a percentage (mechanism §4.3). A result due for
// review still counts as what it was; it is also counted as due.
export function summarize(results: ConditionResult[]): Summary {
  const summary: Summary = { required: noCounts(), preferred: noCounts(), info: 0 }
  for (const r of results) {
    const level = levelOf(r.condition)
    if (level === 'INFO') {
      summary.info += 1
      continue
    }
    const counts = level === 'REQUIRED' ? summary.required : summary.preferred
    counts[r.result === 'MET' ? 'met' : r.result === 'EXCEEDS' ? 'exceeds' : r.result === 'GAP' ? 'gap' : 'unknown'] += 1
    if (r.reviewDue) counts.reviewDue += 1
  }
  return summary
}
