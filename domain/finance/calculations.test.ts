import { describe, expect, it } from 'vitest'

import {
  budgetDaysInPeriod,
  dailyBudget,
  dailyLivingBudget,
  dailySaving,
  expectedSpendToDate,
  formatAmount,
  monthlyLivingBudget,
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

  it('spreads a monthly budget over at most 30 days', () => {
    expect(budgetDaysInPeriod('monthly', new Date(2026, 9, 1))).toBe(30)
    expect(budgetDaysInPeriod('monthly', new Date(2026, 8, 1))).toBe(30)
    expect(budgetDaysInPeriod('monthly', new Date(2026, 1, 1))).toBe(28)
    expect(budgetDaysInPeriod('weekly', new Date(2026, 9, 1))).toBe(7)

    expect(dailyBudget(60000, 'monthly', new Date(2026, 9, 1))).toBe(2000)
    expect(dailyBudget(60000, 'monthly', new Date(2026, 8, 1))).toBe(2000)
  })

  it('derives the daily budget from daily living allocations only', () => {
    const allocations = [
      { amount: 60000, period: 'monthly' as const, category: 'daily_living' },
      { amount: 100000, period: 'monthly' as const, category: 'fixed' },
      { amount: 20000, period: 'weekly' as const, category: 'savings' },
    ]

    expect(dailyLivingBudget(allocations, new Date(2026, 8, 21))).toBe(2000)
    expect(
      dailyLivingBudget(
        [...allocations, { amount: 7000, period: 'weekly' as const, category: 'daily_living' }],
        new Date(2026, 8, 21),
      ),
    ).toBe(3000)
    expect(dailyLivingBudget([], new Date(2026, 8, 21))).toBe(0)
  })

  it('rounds the daily budget down to whole units', () => {
    const allocation = { amount: 50000, period: 'monthly' as const, category: 'daily_living' }

    expect(dailyLivingBudget([allocation], new Date(2026, 8, 21))).toBe(1666)
  })

  it('gives the month budget of the daily living allocations', () => {
    const monthly = { amount: 60000, period: 'monthly' as const, category: 'daily_living' }
    const weekly = { amount: 7000, period: 'weekly' as const, category: 'daily_living' }
    const rent = { amount: 100000, period: 'monthly' as const, category: 'fixed' }

    expect(monthlyLivingBudget([monthly, rent], new Date(2026, 9, 1))).toBe(60000)
    expect(monthlyLivingBudget([weekly], new Date(2026, 8, 1))).toBe(30000)
    expect(monthlyLivingBudget([], new Date(2026, 8, 1))).toBe(0)
  })

  it('tells how much of the month budget should be used by a given day', () => {
    expect(expectedSpendToDate(60000, new Date(2026, 8, 15))).toBe(30000)
    expect(expectedSpendToDate(60000, new Date(2026, 9, 31))).toBe(60000)
    expect(expectedSpendToDate(56000, new Date(2026, 1, 14))).toBe(28000)
  })

  it('formats amounts as whole units', () => {
    expect(formatAmount(60000)).toBe('60,000')
    expect(formatAmount(1935.48)).toBe('1,935')
    expect(formatAmount(Number.NaN)).toBe('0')
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
