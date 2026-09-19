import { describe, expect, it } from 'vitest'

import {
  dailyBudget,
  dailySaving,
  daysInPeriod,
  overspending,
  remainingAllocation,
} from './calculations'

describe('finance calculations', () => {
  it('uses the real number of days in a month', () => {
    expect(daysInPeriod('monthly', new Date(2026, 1, 1))).toBe(28)
    expect(daysInPeriod('monthly', new Date(2024, 1, 1))).toBe(29)
    expect(daysInPeriod('monthly', new Date(2026, 0, 1))).toBe(31)
  })

  it('calculates the daily budget based on the period length', () => {
    expect(dailyBudget(300000, 'monthly', new Date(2026, 1, 1))).toBe(10714.285714285714)
    expect(dailyBudget(7000, 'weekly', new Date(2026, 5, 1))).toBe(1000)
  })

  it('tracks remaining allocation, saving and overspend correctly', () => {
    expect(remainingAllocation(2000, 1600)).toBe(400)
    expect(dailySaving(2000, 1600)).toBe(400)
    expect(overspending(3500, 2000)).toBe(1500)
  })
})
