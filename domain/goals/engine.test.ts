import { describe, expect, it } from 'vitest'

import {
  aggregate,
  combine,
  compare,
  evaluateGroup,
  inRange,
  progress,
  windowRange,
  type ConditionGroup,
  type GoalCondition,
  type Point,
} from './engine'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)
const point = (date: Date, value = 1): Point => ({ at: date, value })

describe('windowRange', () => {
  // Wednesday 7 October 2026
  const now = at(2026, 10, 7)
  const start = at(2026, 9, 1)

  it('leaves all-time windows open and starts others at the goal start', () => {
    expect(windowRange({ type: 'ALL_TIME' }, now, start)).toEqual({})
    expect(windowRange({ type: 'SINCE_GOAL_START' }, now, start)).toEqual({ from: start })
  })

  it('starts weeks on Monday and covers the whole week', () => {
    const range = windowRange({ type: 'CALENDAR', unit: 'week' }, now, start)
    expect(range.from).toEqual(new Date(2026, 9, 5))
    expect(range.to).toEqual(new Date(2026, 9, 11, 23, 59, 59, 999))
  })

  it('treats Sunday as the end of the week, not the start', () => {
    const sunday = at(2026, 10, 11)
    expect(windowRange({ type: 'CALENDAR', unit: 'week' }, sunday, start).from).toEqual(new Date(2026, 9, 5))
  })

  it('covers the whole month, including days still to come', () => {
    const range = windowRange({ type: 'CALENDAR', unit: 'month' }, now, start)
    expect(range.from).toEqual(new Date(2026, 9, 1))
    expect(range.to).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999))
  })

  it('covers a day and a year', () => {
    expect(windowRange({ type: 'CALENDAR', unit: 'day' }, now, start).from).toEqual(new Date(2026, 9, 7))
    expect(windowRange({ type: 'CALENDAR', unit: 'year' }, now, start).to).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999))
  })

  it('looks back a number of days for a rolling window', () => {
    expect(windowRange({ type: 'ROLLING', days: 7 }, now, start).from).toEqual(new Date(now.getTime() - 7 * 86_400_000))
  })
})

describe('inRange', () => {
  it('keeps the points inside inclusive bounds', () => {
    const points = [point(at(2026, 9, 30)), point(new Date(2026, 9, 1)), point(at(2026, 11, 1))]
    expect(inRange(points, { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31, 23, 59, 59, 999) })).toEqual([points[1]])
  })
})

describe('aggregate', () => {
  const now = at(2026, 10, 7)
  const points = [point(at(2026, 10, 1), 5), point(at(2026, 10, 3), 2), point(at(2026, 10, 2), 9)]

  it('reduces points to one number', () => {
    expect(aggregate(points, 'LATEST', now)).toBe(2)
    expect(aggregate(points, 'SUM', now)).toBe(16)
    expect(aggregate(points, 'COUNT', now)).toBe(3)
    expect(aggregate(points, 'MAX', now)).toBe(9)
    expect(aggregate(points, 'MIN', now)).toBe(2)
    expect(aggregate(points, 'AVG', now)).toBeCloseTo(16 / 3)
  })

  it('gives zero without points', () => {
    expect(aggregate([], 'LATEST', now)).toBe(0)
    expect(aggregate([], 'RATIO', now)).toBe(0)
  })

  it('takes the last given point among points of the same moment', () => {
    const same = at(2026, 10, 1)
    expect(aggregate([point(same, 10), point(same, 4)], 'LATEST', now)).toBe(4)
  })

  it('gives the share of done points as a ratio', () => {
    expect(aggregate([point(now, 1), point(now, 0), point(now, 1), point(now, 0)], 'RATIO', now)).toBe(0.5)
  })

  it('counts a streak of days up to today, or up to yesterday before today is in', () => {
    const days = [at(2026, 10, 7), at(2026, 10, 6), at(2026, 10, 5), at(2026, 10, 3)].map((d) => point(d))
    expect(aggregate(days, 'STREAK', now)).toBe(3)
    expect(aggregate(days.slice(1), 'STREAK', now)).toBe(2)
    expect(aggregate(days.slice(3), 'STREAK', now)).toBe(0)
  })
})

describe('compare and progress', () => {
  it('compares with each operator', () => {
    expect(compare('GTE', 5, 5)).toBe(true)
    expect(compare('GT', 5, 5)).toBe(false)
    expect(compare('LTE', 5, 5)).toBe(true)
    expect(compare('LT', 4, 5)).toBe(true)
    expect(compare('EQ', 1, 1)).toBe(true)
  })

  it('fills a bar towards a floor target, and is binary for a ceiling', () => {
    expect(progress('GTE', 8000, 30000)).toBeCloseTo(0.2667, 3)
    expect(progress('GTE', 40000, 30000)).toBe(1)
    expect(progress('GTE', -5, 10)).toBe(0)
    expect(progress('LTE', 2, 3)).toBe(1)
    expect(progress('LTE', 4, 3)).toBe(0)
  })

  it('combines with ALL or ANY', () => {
    expect(combine('ALL', [true, false])).toBe(false)
    expect(combine('ANY', [true, false])).toBe(true)
    expect(combine('ALL', [])).toBe(true)
  })
})

describe('evaluateGroup', () => {
  const now = at(2026, 10, 7)
  const condition = (id: string, target: number): GoalCondition => ({
    id,
    source: 'TEST',
    sourceRef: { id },
    aggregation: 'SUM',
    window: { type: 'ALL_TIME' },
    operator: 'GTE',
    target,
  })
  // Each condition reads points worth its own id's number.
  const resolve = (c: GoalCondition) => [point(now, Number(c.sourceRef.id))]

  it('nests groups: (passed) OR (hours AND words)', () => {
    const group: ConditionGroup = {
      id: 'root',
      logic: 'ANY',
      role: 'COMPLETION',
      conditions: [condition('0', 1)],
      children: [{ id: 'both', logic: 'ALL', role: 'COMPLETION', conditions: [condition('300', 300), condition('2000', 2000)], children: [] }],
    }

    const result = evaluateGroup(group, resolve, now, now)
    expect(result.satisfied).toBe(true)
    expect(result.results.map((r) => [r.condition.id, r.satisfied])).toEqual([
      ['0', false],
      ['300', true],
      ['2000', true],
    ])
  })
})
