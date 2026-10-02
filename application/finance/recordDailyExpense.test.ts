import { describe, expect, it, vi } from 'vitest'

import { recordDailyExpense } from './recordDailyExpense'

const chests = [
  { id: 'buffer', name: 'Buffer', isSystem: true, balance: 800 },
  { id: 'base', name: 'Base Chest', isSystem: true, balance: 5000 },
]

const depsOf = (today: { uncoveredDay: boolean; reserveBudgetLeft: number }) => ({
  getToday: vi.fn().mockResolvedValue({ ...today, chests }),
  recordExpense: vi.fn(),
  recordMovement: vi.fn(),
})

const expense = { userId: 'user-1', amount: 1500, category: 'food', description: 'Lunch' }

describe('recordDailyExpense', () => {
  it('only records the expense on a day the plan covers', async () => {
    const deps = depsOf({ uncoveredDay: false, reserveBudgetLeft: 0 })
    const today = new Date(2026, 9, 30, 12)

    await recordDailyExpense(expense, deps, today)

    expect(deps.recordExpense).toHaveBeenCalledWith({ ...expense, date: today })
    expect(deps.recordMovement).not.toHaveBeenCalled()
  })

  it('on the 31st, takes the expense from the Buffer first, then the Base Chest', async () => {
    const deps = depsOf({ uncoveredDay: true, reserveBudgetLeft: 2000 })

    await recordDailyExpense(expense, deps, new Date(2026, 9, 31, 12))

    expect(deps.recordExpense).toHaveBeenCalledTimes(1)
    expect(deps.recordMovement.mock.calls.map(([movement]) => movement)).toEqual([
      { userId: 'user-1', amount: 800, type: 'OUT', reason: 'EXPENSE', sourceChestId: 'buffer', notes: 'Day 31 spending' },
      { userId: 'user-1', amount: 700, type: 'OUT', reason: 'EXPENSE', sourceChestId: 'base', notes: 'Day 31 spending' },
    ])
  })

  it("never takes more than what is left of the day's budget", async () => {
    const deps = depsOf({ uncoveredDay: true, reserveBudgetLeft: 300 })

    await recordDailyExpense(expense, deps, new Date(2026, 9, 31, 12))

    expect(deps.recordMovement).toHaveBeenCalledTimes(1)
    expect(deps.recordMovement).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, sourceChestId: 'buffer' }))
  })
})
