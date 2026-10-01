import { describe, expect, it, vi } from 'vitest'

import { recomputeFinanceState } from './recomputeFinanceState'

const TODAY = new Date(2026, 8, 15, 12)

const chests = [
  { id: 'buffer', name: 'Buffer', type: 'AVAILABLE', isSystem: true },
  { id: 'base', name: 'Base Chest', type: 'AVAILABLE', isSystem: true },
]

const movement = (overrides: Record<string, unknown>) => ({
  id: 'movement',
  type: 'IN',
  reason: 'PLANNED_SAVING',
  date: new Date(2026, 8, 1),
  sourceChestId: null,
  destinationChestId: null,
  amount: 0,
  ...overrides,
})

const repositoryOf = (data: {
  allocations?: unknown[]
  expenses?: unknown[]
  movements?: unknown[]
  exceptions?: unknown[]
}) =>
  ({
    listIncomes: vi.fn().mockResolvedValue([{ id: 'income-1', amount: 300000 }]),
    listAllocations: vi.fn().mockResolvedValue(
      data.allocations ?? [
        { id: 'alloc-1', name: 'Bread', amount: 60000, period: 'monthly', category: 'daily_living' },
        { id: 'alloc-2', name: 'Rent', amount: 100000, period: 'monthly', category: 'fixed' },
      ],
    ),
    listExpenses: vi.fn().mockResolvedValue(data.expenses ?? []),
    listBudgetExceptions: vi.fn().mockResolvedValue(data.exceptions ?? []),
    listChests: vi.fn().mockResolvedValue(chests),
    listMovements: vi.fn().mockResolvedValue(data.movements ?? []),
    listGoals: vi.fn().mockResolvedValue([]),
  }) as never

describe('recomputeFinanceState', () => {
  it('spreads the daily living allocation over the month for the daily view', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        expenses: [
          {
            id: 'expense-1',
            amount: 1800,
            category: 'food',
            description: 'Lunch',
            date: TODAY,
            project: { id: 'project-1', name: 'Weekend trip' },
          },
          { id: 'expense-2', amount: 400, category: 'transport', description: 'Taxi', date: new Date(2026, 7, 20) },
        ],
        movements: [
          movement({ id: 'm-1', destinationChestId: 'base', amount: 250 }),
          movement({ id: 'm-2', destinationChestId: 'buffer', amount: 150 }),
        ],
        exceptions: [
          { id: 'exception-1', date: new Date(2026, 8, 3) },
          { id: 'exception-2', date: new Date(2026, 7, 20) },
        ],
      }),
    })

    expect(state.incomeTotal).toBe(300000)
    expect(state.allocationTotal).toBe(160000)
    expect(state.dailyLivingAllocation).toBe(60000)
    expect(state.dailyBudget).toBe(2000)
    expect(state.periodBudget).toBe(60000)
    expect(state.dailySpent).toBe(1800)
    expect(state.dailyExpenses).toHaveLength(1)
    expect(state.dailyExpenses[0]).toMatchObject({
      id: 'expense-1',
      amount: 1800,
      category: 'food',
      description: 'Lunch',
      projectName: 'Weekend trip',
    })
    expect(state.dailyRemaining).toBe(200)
    expect(state.monthlySpent).toBe(1800)
    expect(state.monthlyRemaining).toBe(60000 - 1800)
    expect(state.actualSavings).toBe(250)
    expect(state.buffer).toBe(150)
    expect(state.exceptionCount).toBe(1)
    expect(state.overspendExplained).toBe(false)
    expect(state.totalSaved).toBe(400)
  })

  it('keeps the same daily budget in a 31-day month', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: new Date(2026, 9, 10, 12),
      repository: repositoryOf({}),
    })

    expect(state.dailyBudget).toBe(2000)
    expect(state.periodBudget).toBe(60000)
  })

  it('divides a weekly daily living allocation by seven', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        allocations: [{ id: 'alloc-1', name: 'Bread', amount: 7000, period: 'weekly', category: 'daily_living' }],
      }),
    })

    expect(state.dailyBudget).toBe(1000)
    expect(state.periodBudget).toBe(30000)
  })

  it("treats what was saved today as used, so the day is fully cleared", async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        expenses: [{ id: 'expense-1', amount: 1200, category: 'food', description: 'Lunch', date: TODAY }],
        movements: [
          movement({ id: 'm-1', reason: 'DAILY_SAVING', date: TODAY, destinationChestId: 'buffer', amount: 800 }),
        ],
      }),
    })

    expect(state.dailySpent).toBe(1200)
    expect(state.dailyRemaining).toBe(0)
    expect(state.dailySaving).toBe(0)
    expect(state.savedToday).toBe(800)
    expect(state.dailyOverspend).toBe(0)
    expect(state.buffer).toBe(800)
  })

  it('counts money saved earlier in the day when spending goes on', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        expenses: [{ id: 'expense-1', amount: 1500, category: 'food', description: 'Dinner', date: TODAY }],
        movements: [
          movement({ id: 'm-1', reason: 'DAILY_SAVING', date: TODAY, destinationChestId: 'buffer', amount: 2000 }),
        ],
        exceptions: [{ id: 'exception-1', date: TODAY }],
      }),
    })

    expect(state.savedToday).toBe(2000)
    expect(state.dailyRemaining).toBe(0)
    expect(state.dailyOverspend).toBe(1500)
    expect(state.overspendExplained).toBe(true)
  })

  it('is never over without a daily budget, and totals weekly allocations per month', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        allocations: [
          { id: 'alloc-1', name: 'Rent', amount: 100000, period: 'monthly', category: 'fixed' },
          { id: 'alloc-2', name: 'Gym', amount: 7000, period: 'weekly', category: 'fixed' },
        ],
        expenses: [{ id: 'expense-1', amount: 500, category: 'food', description: 'Snack', date: TODAY }],
      }),
    })

    expect(state.dailyBudget).toBe(0)
    expect(state.dailySpent).toBe(500)
    expect(state.dailyOverspend).toBe(0)
    expect(state.allocationTotal).toBe(130000)
  })

  it('moves money from the buffer to savings on a transfer', async () => {
    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: TODAY,
      repository: repositoryOf({
        movements: [
          movement({ id: 'm-1', reason: 'DAILY_SAVING', destinationChestId: 'buffer', amount: 800 }),
          movement({
            id: 'm-2',
            type: 'TRANSFER',
            reason: 'BUFFER_CONSOLIDATION',
            sourceChestId: 'buffer',
            destinationChestId: 'base',
            amount: 200,
          }),
        ],
      }),
    })

    expect(state.buffer).toBe(600)
    expect(state.actualSavings).toBe(200)
    expect(state.chests).toEqual([
      { id: 'buffer', name: 'Buffer', type: 'AVAILABLE', isSystem: true, balance: 600 },
      { id: 'base', name: 'Base Chest', type: 'AVAILABLE', isSystem: true, balance: 200 },
    ])
  })
})
