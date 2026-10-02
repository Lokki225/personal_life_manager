import { describe, expect, it, vi } from 'vitest'

import { recordDailyExpense } from './recordDailyExpense'

const chests = [
  { id: 'buffer', name: 'Buffer', isSystem: true, balance: 800 },
  { id: 'base', name: 'Base Chest', isSystem: true, balance: 5000 },
]

const depsOf = (today: Record<string, unknown> = {}) => ({
  getToday: vi.fn().mockResolvedValue({
    dailyBudget: 2000,
    dailyRemaining: 2000,
    uncoveredDay: false,
    reserveBudgetLeft: 0,
    chests,
    ...today,
  }),
  recordExpense: vi.fn().mockResolvedValue({ id: 'expense-1' }),
  recordMovement: vi.fn(),
  createException: vi.fn(),
})

const expense = { userId: 'user-1', amount: 1500, category: 'food', description: 'Lunch' }
const today = new Date(2026, 9, 30, 12)

describe('recordDailyExpense', () => {
  it('only records the expense when it fits in what is left of the day', async () => {
    const deps = depsOf()

    await recordDailyExpense(expense, deps, today)

    expect(deps.recordExpense).toHaveBeenCalledWith({ ...expense, date: today })
    expect(deps.createException).not.toHaveBeenCalled()
    expect(deps.recordMovement).not.toHaveBeenCalled()
  })

  it('records the part that goes over as an exception tied to the expense, with its cause', async () => {
    const deps = depsOf({ dailyRemaining: 500 })

    await recordDailyExpense(
      { ...expense, amount: 800, cause: 'transport', reason: 'Missed the bus' },
      deps,
      today,
    )

    expect(deps.createException).toHaveBeenCalledWith({
      userId: 'user-1',
      date: today,
      plannedAmount: 500,
      actualAmount: 800,
      difference: 300,
      category: 'transport',
      reason: 'Missed the bus',
      resolution: 'Review next cycle',
      expenseId: 'expense-1',
    })
  })

  it('counts every expense of a day already over in full, with a default cause', async () => {
    const deps = depsOf({ dailyRemaining: 0 })

    await recordDailyExpense({ ...expense, amount: 300 }, deps, today)

    expect(deps.createException).toHaveBeenCalledWith(
      expect.objectContaining({ difference: 300, category: 'other', reason: 'Unplanned spending' }),
    )
  })

  it('has nothing to go over without a daily budget', async () => {
    const deps = depsOf({ dailyBudget: 0, dailyRemaining: 0 })

    await recordDailyExpense(expense, deps, today)

    expect(deps.createException).not.toHaveBeenCalled()
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
    const deps = depsOf({ uncoveredDay: true, reserveBudgetLeft: 300, dailyRemaining: 300 })

    await recordDailyExpense(expense, deps, new Date(2026, 9, 31, 12))

    expect(deps.recordMovement).toHaveBeenCalledTimes(1)
    expect(deps.recordMovement).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, sourceChestId: 'buffer' }))
  })
})
