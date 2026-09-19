import { describe, expect, it, vi } from 'vitest'

import { getHistory } from './getHistory'

describe('getHistory', () => {
  it('filters the event list by period and type', async () => {
    const repository = {
      listExpenses: vi.fn().mockResolvedValue([
        { id: 'e-1', amount: 120, category: 'food', description: 'Lunch', date: new Date('2026-09-15T09:00:00Z') },
        { id: 'e-2', amount: 50, category: 'transportation', description: 'Taxi', date: new Date('2026-08-20T09:00:00Z') },
      ]),
      listSavings: vi.fn().mockResolvedValue([
        { id: 's-1', amount: 300, destination: 'buffer', notes: 'Leftover', date: new Date('2026-09-15T09:00:00Z') },
      ]),
      listBudgetExceptions: vi.fn().mockResolvedValue([
        { id: 'x-1', category: 'emergency', difference: 100, reason: 'Late bill', resolution: 'Review', date: new Date('2026-09-17T09:00:00Z') },
      ]),
      createExpense: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      createSaving: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
      createBudgetException: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const events = await getHistory({
      userId: 'user-1',
      period: 'month',
      type: 'expense',
      referenceDate: new Date('2026-09-15T09:00:00Z'),
      repository,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'expense',
      category: 'food',
      amount: 120,
    })
  })

  it('includes the project name on expense events when a project is attached', async () => {
    const repository = {
      listExpenses: vi.fn().mockResolvedValue([
        {
          id: 'e-3',
          amount: 200,
          category: 'travel',
          description: 'Flight',
          date: new Date('2026-09-12T10:00:00Z'),
          project: { id: 'p-1', name: 'Summer trip' },
        },
      ]),
      listSavings: vi.fn().mockResolvedValue([]),
      listBudgetExceptions: vi.fn().mockResolvedValue([]),
      createExpense: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      createSaving: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
      createBudgetException: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const events = await getHistory({
      userId: 'user-1',
      period: 'month',
      type: 'expense',
      referenceDate: new Date('2026-09-15T09:00:00Z'),
      repository,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'expense',
      projectName: 'Summer trip',
      label: 'Flight',
    })
  })
})
