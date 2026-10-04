import type { ConditionGroup, GoalCondition } from './engine'

// Goal presets (Personal spec §6.1): they fill in the condition tree, so
// nobody has to build one by hand. The engine only ever sees conditions.

export const PRESETS = ['outcome', 'accumulation', 'milestones', 'habit', 'checklist'] as const
export type Preset = (typeof PRESETS)[number]

export const HORIZONS = ['WEEK', 'QUARTER', 'YEAR', 'SOMEDAY'] as const
export type Horizon = (typeof HORIZONS)[number]

type NewCondition = Omit<GoalCondition, 'id'>
type NewGroup = Omit<ConditionGroup, 'id' | 'conditions' | 'children'> & { conditions: NewCondition[] }

export type GoalPlan = {
  name: string
  domain: 'personal'
  lifecycle: 'TERMINAL' | 'ONGOING'
  latch: boolean
  horizon: Horizon
  deadline: Date | null
  categoryId: string | null
  groups: NewGroup[]
  milestones: { name: string; order: number }[]
}

type Common = { name: string; horizon: Horizon; deadline: Date | null; categoryId: string | null }

// "This goal" in a source: the goal id is only known once it is created, so
// sources read it from the goal they evaluate.
const THIS_GOAL = { goal: 'self' }

const completion = (condition: NewCondition): NewGroup => ({ logic: 'ALL', role: 'COMPLETION', conditions: [condition] })
const health = (condition: NewCondition): NewGroup => ({ logic: 'ALL', role: 'HEALTH', conditions: [condition] })

const terminal = (common: Common, groups: NewGroup[], milestones: string[] = []): GoalPlan => ({
  ...common,
  domain: 'personal',
  lifecycle: 'TERMINAL',
  latch: true,
  groups,
  milestones: milestones.map((name, order) => ({ name, order })),
})

// A level to reach: "1800 rapid".
export function outcomePreset(p: Common & { seriesId: string; target: number; unit: string | null }) {
  return terminal(p, [
    completion({
      source: 'METRIC_SERIES',
      sourceRef: { seriesId: p.seriesId },
      aggregation: 'LATEST',
      window: { type: 'ALL_TIME' },
      operator: 'GTE',
      target: p.target,
      unit: p.unit,
    }),
  ])
}

// An amount of time to put in: "150 hours of Japanese".
export function accumulationPreset(p: Common & { hours: number }) {
  return terminal(p, [
    completion({
      source: 'SESSIONS',
      sourceRef: { ...THIS_GOAL, measure: 'hours' },
      aggregation: 'SUM',
      window: { type: 'SINCE_GOAL_START' },
      operator: 'GTE',
      target: p.hours,
      unit: 'hours',
    }),
  ])
}

// Steps to go through: "Learn Japanese (N5)". Done when every milestone is.
export function milestonePreset(p: Common & { milestones: string[] }) {
  return terminal(
    p,
    [
      completion({
        source: 'MILESTONES',
        sourceRef: THIS_GOAL,
        aggregation: 'RATIO',
        window: { type: 'ALL_TIME' },
        operator: 'EQ',
        target: 1,
      }),
    ],
    p.milestones,
  )
}

// Something to keep doing: "Study 5 times a week". Never finished; it holds
// or not each week.
export function habitPreset(p: Common & { perWeek: number; counts: 'sessions' | 'tasks'; floor: number | null; stretch: number | null }) {
  const condition: NewCondition = {
    source: p.counts === 'sessions' ? 'SESSIONS' : 'TASKS',
    sourceRef: p.counts === 'sessions' ? { ...THIS_GOAL, measure: 'count' } : THIS_GOAL,
    aggregation: 'COUNT',
    window: { type: 'CALENDAR', unit: 'week' },
    operator: 'GTE',
    target: p.perWeek,
    unit: p.counts,
    floor: p.floor,
    stretch: p.stretch,
  }

  return { ...terminal(p, [completion(condition)]), lifecycle: 'ONGOING' as const, latch: false }
}

// A list to finish: "Set up the home studio". Done when all its tasks are.
export function checklistPreset(p: Common) {
  return terminal(p, [
    completion({
      source: 'TASKS',
      sourceRef: { ...THIS_GOAL, measure: 'ratio' },
      aggregation: 'RATIO',
      window: { type: 'ALL_TIME' },
      operator: 'EQ',
      target: 1,
    }),
  ])
}

// Adds "N sessions a week" as a health check to a goal that ends.
export function withWeeklySessions(plan: GoalPlan, perWeek: number | null): GoalPlan {
  if (!perWeek || plan.lifecycle !== 'TERMINAL') return plan

  return {
    ...plan,
    groups: [
      ...plan.groups,
      health({
        source: 'SESSIONS',
        sourceRef: { ...THIS_GOAL, measure: 'count' },
        aggregation: 'COUNT',
        window: { type: 'CALENDAR', unit: 'week' },
        operator: 'GTE',
        target: perWeek,
        unit: 'sessions',
      }),
    ],
  }
}

// Which preset a goal's completion condition came from, for labels.
export function presetOf(condition: Pick<GoalCondition, 'source' | 'aggregation'>, lifecycle: string): Preset | null {
  if (lifecycle !== 'TERMINAL') return 'habit'
  if (condition.source === 'METRIC_SERIES') return 'outcome'
  if (condition.source === 'SESSIONS') return 'accumulation'
  if (condition.source === 'MILESTONES') return 'milestones'
  if (condition.source === 'TASKS') return 'checklist'
  return null
}
