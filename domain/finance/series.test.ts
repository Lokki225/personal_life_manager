import { describe, expect, it } from 'vitest'

import { periodBuckets, runningBalance, sumByBucket } from './series'

// Thursday 15 October 2026.
const today = new Date(2026, 9, 15, 12)

describe('periodBuckets', () => {
  it('cuts a week into seven days from Monday', () => {
    const buckets = periodBuckets('week', today)

    expect(buckets).toHaveLength(7)
    expect(buckets[0].start).toEqual(new Date(2026, 9, 12))
    expect(buckets[6].end).toEqual(new Date(2026, 9, 18, 23, 59, 59, 999))
  })

  it('cuts a month into its days and a year into its months', () => {
    expect(periodBuckets('month', today)).toHaveLength(31)
    expect(periodBuckets('month', new Date(2026, 1, 10))).toHaveLength(28)

    const months = periodBuckets('year', today)
    expect(months).toHaveLength(12)
    expect(months[1]).toEqual({ start: new Date(2026, 1, 1), end: new Date(2026, 1, 28, 23, 59, 59, 999) })
  })
})

describe('sumByBucket', () => {
  it('adds up the entries of each day and ignores those outside the period', () => {
    const totals = sumByBucket(periodBuckets('week', today), [
      { date: new Date(2026, 9, 12, 8), amount: 500 },
      { date: new Date(2026, 9, 12, 20), amount: 700 },
      { date: new Date(2026, 9, 15, 9), amount: 300 },
      { date: new Date(2026, 9, 11, 23), amount: 9000 },
    ])

    expect(totals).toEqual([1200, 0, 0, 300, 0, 0, 0])
  })
})

describe('runningBalance', () => {
  it('carries what came before the period and stops at today', () => {
    const balance = runningBalance(
      periodBuckets('week', today),
      [
        { date: new Date(2026, 8, 1), amount: 10000 },
        { date: new Date(2026, 9, 13, 9), amount: 2000 },
        { date: new Date(2026, 9, 15, 9), amount: -500 },
      ],
      today,
    )

    expect(balance).toEqual([10000, 12000, 12000, 11500, null, null, null])
  })
})
