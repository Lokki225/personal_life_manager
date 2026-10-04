import { describe, expect, it } from 'vitest'

import { buildWeeklyReview, weekOf } from './review'

describe('weekOf', () => {
  it('runs Monday to Monday, with Sunday in the week before it', () => {
    expect(weekOf(new Date(2026, 9, 7, 15))).toEqual({ start: new Date(2026, 9, 5), end: new Date(2026, 9, 12) })
    expect(weekOf(new Date(2026, 9, 11, 23)).start).toEqual(new Date(2026, 9, 5))
    expect(weekOf(new Date(2026, 9, 12)).start).toEqual(new Date(2026, 9, 12))
  })
})

describe('buildWeeklyReview', () => {
  const review = buildWeeklyReview({
    completions: [{ taskId: 'a' }, { taskId: 'b' }, { taskId: 'a' }],
    carries: [
      { taskId: 'c', days: 1, reason: 'no_time' },
      { taskId: 'd', days: 3, reason: null },
      { taskId: 'e', days: 2, reason: 'no_time' },
      { taskId: 'f', days: 1, reason: 'blocked' },
    ],
    sessions: [
      { goal: 'Chess', durationMin: 30 },
      { goal: null, durationMin: 20 },
      { goal: 'Chess', durationMin: 45 },
      { goal: 'Japanese', durationMin: 60 },
    ],
    goals: [
      { id: '1', name: 'Chess', status: 'ON_TRACK', lifecycle: 'TERMINAL' },
      { id: '2', name: 'Studio', status: 'ACHIEVED', lifecycle: 'TERMINAL' },
      { id: '3', name: 'Study', status: 'MAINTAINING', lifecycle: 'ONGOING' },
      { id: '4', name: 'Run', status: 'LAPSED', lifecycle: 'ONGOING' },
      { id: '5', name: 'Old', status: 'ABANDONED', lifecycle: 'TERMINAL' },
    ],
    stillRelevant: [
      { id: 'x', title: 'Fix the shelf', carryCount: 3 },
      { id: 'y', title: 'Call the bank', carryCount: 5 },
    ],
    entries: 4,
  })

  it('counts tasks done and the days they slipped, with the reasons', () => {
    expect(review.tasksDone).toBe(3)
    expect(review.slips).toBe(7)
    expect(review.reasons).toEqual([
      { reason: 'no_time', count: 3 },
      { reason: 'none', count: 3 },
      { reason: 'blocked', count: 1 },
    ])
    expect(review.topReason).toBe('no_time')
  })

  it('adds up time by goal', () => {
    expect(review.sessions).toEqual({
      count: 4,
      minutes: 155,
      byGoal: [
        { goal: 'Chess', minutes: 75 },
        { goal: 'Japanese', minutes: 60 },
        { goal: null, minutes: 20 },
      ],
    })
  })

  it('sorts goals and habits, leaving abandoned ones out', () => {
    expect(review.goals.total).toBe(4)
    expect(review.goals.onTrack.map((g) => g.name)).toEqual(['Chess'])
    expect(review.goals.achieved.map((g) => g.name)).toEqual(['Studio'])
    expect(review.goals.habitsKept.map((g) => g.name)).toEqual(['Study'])
    expect(review.goals.habitsSlipping.map((g) => g.name)).toEqual(['Run'])
    expect(review.stillRelevant.map((t) => t.title)).toEqual(['Call the bank', 'Fix the shelf'])
  })

  it('has no top reason when none was given', () => {
    expect(buildWeeklyReview({ completions: [], carries: [{ taskId: 'a', days: 1, reason: null }], sessions: [], goals: [], stillRelevant: [], entries: 0 }).topReason).toBeNull()
  })
})
