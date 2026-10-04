import { describe, expect, it } from 'vitest'

import type { ConditionGroup } from './engine'
import { projectDate, tierOf } from './pace'
import { evaluatePersonalGoal, type GoalTree } from './personalGoal'
import type { PersonalEvidence } from './personalSources'
import { accumulationPreset, checklistPreset, habitPreset, milestonePreset, outcomePreset, withWeeklySessions, type GoalPlan } from './presets'
import { deriveStatus, shouldStampAchieved } from './status'

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h)
const now = at(10, 7)
const common = { name: 'Goal', horizon: 'YEAR' as const, deadline: null, categoryId: null }

// A goal tree as the repository would load it, from a preset's plan.
function tree(plan: GoalPlan, extra: Partial<GoalTree> = {}): GoalTree {
  return {
    id: 'g',
    lifecycle: plan.lifecycle,
    latch: plan.latch,
    startDate: at(9, 1),
    deadline: plan.deadline,
    achievedAt: null,
    abandonedAt: null,
    groups: plan.groups.map(
      (g, i): ConditionGroup => ({ ...g, id: `grp${i}`, conditions: g.conditions.map((c, j) => ({ ...c, id: `c${i}${j}` })), children: [] }),
    ),
    milestones: plan.milestones.map((m, i) => ({ id: `m${i}`, ...m, completedAt: null, groups: [] })),
    ...extra,
  }
}

const empty: PersonalEvidence = { tasks: [], completions: [], sessions: [], entries: [], milestones: [] }

describe('projectDate', () => {
  it('projects an accumulation from its rate since the start', () => {
    // 30 hours in 30 days: one hour a day, 120 to go.
    const points = [{ at: at(9, 20), value: 30 }]
    expect(projectDate(points, 150, 'cumulative', at(9, 7), at(10, 7))?.getTime()).toBe(at(10, 7).getTime() + 120 * 86_400_000)
  })

  it('projects a level from its trend, and gives up on a falling or flat one', () => {
    const rising = [10, 20, 30].map((v, i) => ({ at: at(10, 1 + i * 2), value: 1500 + v }))
    expect(projectDate(rising, 1800, 'level', at(9, 1), at(10, 6))).toBeInstanceOf(Date)
    const falling = [30, 20, 10].map((v, i) => ({ at: at(10, 1 + i), value: 1500 + v }))
    expect(projectDate(falling, 1800, 'level', at(9, 1), now)).toBeNull()
    expect(projectDate(rising.slice(0, 2), 1800, 'level', at(9, 1), now)).toBeNull()
  })

  it('tells where a week stands against floor, target and stretch', () => {
    expect(tierOf(1, 5, 2, 7)).toBe('below')
    expect(tierOf(2, 5, 2, 7)).toBe('floor')
    expect(tierOf(5, 5, 2, 7)).toBe('target')
    expect(tierOf(7, 5, 2, 7)).toBe('stretch')
  })
})

describe('deriveStatus', () => {
  const base = { lifecycle: 'TERMINAL' as const, latch: true, achievedAt: null, abandonedAt: null, deadline: null, satisfied: false, hasEvidence: true, projected: null, healthy: null }

  it('covers each status', () => {
    expect(deriveStatus({ ...base, abandonedAt: now }, now)).toBe('ABANDONED')
    expect(deriveStatus({ ...base, satisfied: true }, now)).toBe('ACHIEVED')
    expect(deriveStatus({ ...base, achievedAt: at(9, 1) }, now)).toBe('ACHIEVED')
    expect(deriveStatus({ ...base, latch: false, achievedAt: at(9, 1) }, now)).toBe('IN_PROGRESS')
    expect(deriveStatus({ ...base, deadline: at(10, 1) }, now)).toBe('EXPIRED')
    expect(deriveStatus({ ...base, hasEvidence: false }, now)).toBe('NOT_STARTED')
    expect(deriveStatus({ ...base, deadline: at(12, 1), projected: at(11, 1) }, now)).toBe('ON_TRACK')
    expect(deriveStatus({ ...base, deadline: at(12, 1), projected: at(12, 2) }, now)).toBe('BEHIND')
    expect(deriveStatus({ ...base, healthy: false }, now)).toBe('BEHIND')
    expect(deriveStatus({ ...base, lifecycle: 'ONGOING', satisfied: true }, now)).toBe('MAINTAINING')
    expect(deriveStatus({ ...base, lifecycle: 'ONGOING' }, now)).toBe('LAPSED')
  })

  it('stamps an achievement once, only for goals that latch', () => {
    expect(shouldStampAchieved({ ...base, satisfied: true })).toBe(true)
    expect(shouldStampAchieved({ ...base, satisfied: true, achievedAt: at(9, 1) })).toBe(false)
    expect(shouldStampAchieved({ ...base, satisfied: true, lifecycle: 'ONGOING' })).toBe(false)
  })
})

describe('Personal goals from presets', () => {
  it('reaches an outcome on the latest value, and stays achieved once stamped', () => {
    const goal = tree(outcomePreset({ ...common, seriesId: 'elo', target: 1800, unit: null }))
    const entries = [
      { seriesId: 'elo', value: 1810, recordedAt: at(10, 3) },
      { seriesId: 'elo', value: 1780, recordedAt: at(10, 6) },
    ]

    const dropped = evaluatePersonalGoal(goal, { ...empty, entries }, now)
    expect(dropped).toMatchObject({ satisfied: false, status: 'IN_PROGRESS' })

    const reached = evaluatePersonalGoal(goal, { ...empty, entries: entries.slice(0, 1) }, now)
    expect(reached).toMatchObject({ satisfied: true, status: 'ACHIEVED', stamp: { achieved: true } })

    expect(evaluatePersonalGoal({ ...goal, achievedAt: at(10, 3) }, { ...empty, entries }, now).status).toBe('ACHIEVED')
  })

  it('adds up hours of the goal’s sessions since it started, with its pace', () => {
    const goal = tree(accumulationPreset({ ...common, deadline: at(12, 31), hours: 20 }))
    const sessions = [
      { goalId: 'g', startedAt: at(9, 10), durationMin: 120 },
      { goalId: 'g', startedAt: at(10, 1), durationMin: 60 },
      { goalId: 'other', startedAt: at(10, 1), durationMin: 600 },
      { goalId: 'g', startedAt: at(8, 1), durationMin: 600 },
    ]

    const result = evaluatePersonalGoal(goal, { ...empty, sessions }, now)
    expect(result.completion[0].actual).toBe(3)
    expect(result.projected).toBeInstanceOf(Date)
    expect(result.status).toBe('BEHIND')
  })

  it('completes milestones from their tasks, then the goal from its milestones', () => {
    const goal = tree(milestonePreset({ ...common, milestones: ['Hiragana', 'Katakana'] }))
    const task = (id: string, milestoneId: string, done: boolean) => ({ id, goalId: 'g', milestoneId, createdAt: at(9, 2), done })

    const half = evaluatePersonalGoal(goal, { ...empty, tasks: [task('a', 'm0', true), task('b', 'm1', false)] }, now)
    expect(half.milestones.map((m) => m.completedAt !== null)).toEqual([true, false])
    expect(half.stamp.milestoneIds).toEqual(['m0'])
    expect(half.completion[0].actual).toBe(0.5)
    expect(half.satisfied).toBe(false)

    const all = evaluatePersonalGoal(goal, { ...empty, tasks: [task('a', 'm0', true), task('b', 'm1', true)] }, now)
    expect(all.satisfied).toBe(true)

    // A milestone without tasks is not done just because it has none.
    expect(evaluatePersonalGoal(goal, empty, now).milestones.every((m) => m.completedAt === null)).toBe(true)
  })

  it('keeps a habit week by week, with its tier', () => {
    const goal = tree(habitPreset({ ...common, perWeek: 5, counts: 'tasks', floor: 2, stretch: 7 }))
    const tasks = [{ id: 't', goalId: 'g', milestoneId: null, createdAt: at(9, 1), done: false }]
    // Monday 5 to Wednesday 7 October, and one the week before.
    const completions = [at(10, 5), at(10, 6), at(10, 7), at(10, 2)].map((d) => ({ taskId: 't', occurrenceDate: d }))

    const result = evaluatePersonalGoal(goal, { ...empty, tasks, completions }, now)
    expect(result.completion[0].actual).toBe(3)
    expect(result.status).toBe('LAPSED')
    expect(goal.lifecycle).toBe('ONGOING')
  })

  it('finishes a checklist when all its tasks are done, not when it has none', () => {
    const goal = tree(checklistPreset(common))
    const tasks = [true, true].map((done, i) => ({ id: `t${i}`, goalId: 'g', milestoneId: null, createdAt: at(9, 2), done }))

    expect(evaluatePersonalGoal(goal, { ...empty, tasks }, now).status).toBe('ACHIEVED')
    expect(evaluatePersonalGoal(goal, empty, now).status).toBe('NOT_STARTED')
  })

  it('judges health on weekly sessions without blocking completion', () => {
    const goal = tree(withWeeklySessions(outcomePreset({ ...common, seriesId: 'elo', target: 1800, unit: null }), 4))
    const result = evaluatePersonalGoal(
      goal,
      { ...empty, entries: [{ seriesId: 'elo', value: 1600, recordedAt: at(10, 1) }], sessions: [{ goalId: 'g', startedAt: at(10, 6), durationMin: 30 }] },
      now,
    )

    expect(result.health[0]).toMatchObject({ actual: 1, satisfied: false, tier: 'below' })
    expect(result.status).toBe('BEHIND')
  })
})
