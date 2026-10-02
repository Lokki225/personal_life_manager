import { describe, expect, it } from 'vitest'

import { activeDays, activeUsersPerDay, activityStatus, latestOf, usageFunnel } from './activity'

const now = new Date(2026, 9, 15, 12)
const daysAgo = (days: number, hour = 10) => new Date(2026, 9, 15 - days, hour)

describe('activityStatus', () => {
  it('is active within a week, quiet within a month, gone after, never without a date', () => {
    expect(activityStatus(daysAgo(0), now)).toBe('active')
    expect(activityStatus(daysAgo(7, 13), now)).toBe('active')
    expect(activityStatus(daysAgo(8), now)).toBe('quiet')
    expect(activityStatus(daysAgo(30, 13), now)).toBe('quiet')
    expect(activityStatus(daysAgo(40), now)).toBe('gone')
    expect(activityStatus(null, now)).toBe('never')
  })
})

describe('latestOf', () => {
  it('picks the most recent date and ignores missing ones', () => {
    expect(latestOf(daysAgo(5), null, daysAgo(2), undefined)).toEqual(daysAgo(2))
    expect(latestOf(null, undefined)).toBeNull()
  })
})

describe('activeUsersPerDay', () => {
  it('counts each person once per day, over the last days up to today', () => {
    const series = activeUsersPerDay(
      [
        { userId: 'a', at: daysAgo(0, 8) },
        { userId: 'a', at: daysAgo(0, 20) },
        { userId: 'b', at: daysAgo(0, 9) },
        { userId: 'a', at: daysAgo(2) },
        { userId: 'c', at: daysAgo(9) },
      ],
      now,
      3,
    )

    expect(series.map((entry) => entry.users)).toEqual([1, 0, 2])
    expect(series[0].day).toEqual(new Date(2026, 9, 13))
    expect(series[2].day).toEqual(new Date(2026, 9, 15))
  })
})

describe('activeDays', () => {
  it('counts different days, not entries', () => {
    expect(activeDays([{ at: daysAgo(0, 8) }, { at: daysAgo(0, 20) }, { at: daysAgo(3) }])).toBe(2)
  })
})

describe('usageFunnel', () => {
  it('counts who reached each step', () => {
    const joined = daysAgo(40)
    const funnel = usageFunnel([
      { createdAt: joined, hasPlan: false, expenses: 0, lastEntryAt: null },
      { createdAt: joined, hasPlan: true, expenses: 0, lastEntryAt: null },
      { createdAt: joined, hasPlan: true, expenses: 3, lastEntryAt: daysAgo(38) },
      { createdAt: joined, hasPlan: true, expenses: 9, lastEntryAt: daysAgo(30) },
      { createdAt: joined, hasPlan: true, expenses: 40, lastEntryAt: daysAgo(1) },
    ])

    expect(funnel).toEqual({ signedUp: 5, planSetUp: 4, firstExpense: 3, afterAWeek: 2, afterAMonth: 1 })
  })
})
