import { describe, expect, it } from 'vitest'

import {
  dailyBudget,
  dailySaving,
  daysInPeriod,
  formatCurrency,
  getDailyFinanceStatus,
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

  it('formats values in the local XOF currency', () => {
    expect(formatCurrency(1500)).toBe('XOF 1,500.00')
    expect(formatCurrency(0)).toBe('XOF 0.00')
  })

  it('classifies the daily finance state as safe, caution, or overspent', () => {
    expect(getDailyFinanceStatus(500, 200)).toMatchObject({
      label: 'Safe',
      tone: 'emerald',
      message: 'You can still save XOF 300.00 today.',
    })

    expect(getDailyFinanceStatus(500, 450)).toMatchObject({
      label: 'Caution',
      tone: 'amber',
      message: 'You are close to today’s budget. XOF 50.00 remains.',
    })

    expect(getDailyFinanceStatus(500, 650)).toMatchObject({
      label: 'Overspent',
      tone: 'rose',
      message: 'You are over your daily budget by XOF 150.00.',
    })
  })
})
