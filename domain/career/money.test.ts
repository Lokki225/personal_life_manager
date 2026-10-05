import { describe, expect, it } from 'vitest'

import { incomePerMonth, perMonth, runway } from './money'

const today = new Date(2026, 9, 7) // October: 31 days

describe('runway (scenario 5)', () => {
  const chests = [
    { name: 'Base Chest', isSystem: true, type: 'AVAILABLE', lockedUntil: null, balance: 600000 },
    { name: 'Buffer', isSystem: true, type: 'AVAILABLE', lockedUntil: null, balance: 150000 },
    { name: 'Debts Chest', isSystem: true, type: 'AVAILABLE', lockedUntil: null, balance: 500000 },
    { name: 'House', isSystem: false, type: 'SECURE', lockedUntil: new Date(2027, 0, 1), balance: 2000000 },
    { name: 'Trip', isSystem: false, type: 'SECURE', lockedUntil: new Date(2026, 9, 1), balance: 250000 },
  ]
  const allocations = [
    { amount: 200000, period: 'monthly', category: 'daily_living' },
    { amount: 50000, period: 'monthly', category: 'fixed' },
    { amount: 100000, period: 'monthly', category: 'savings' },
  ]

  it('counts unlocked chests that are not borrowed money, against the plan without its savings', () => {
    expect(runway({ chests, allocations }, today)).toEqual({ available: 1000000, monthlyNeed: 250000, months: 4 })
  })

  it('says nothing when the plan spends nothing', () => {
    expect(runway({ chests, allocations: [] }, today).months).toBeNull()
  })
})

describe('amounts per month', () => {
  it('spread weekly and daily amounts over the month’s real length', () => {
    expect(perMonth(7000, 'weekly', today)).toBe(31000)
    expect(perMonth(1000, 'daily', today)).toBe(31000)
    expect(incomePerMonth({ amount: 450000, frequency: 'monthly' }, today)).toBe(450000)
  })
})
