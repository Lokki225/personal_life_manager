import { describe, expect, it, vi } from 'vitest'

import { getHistory, historyTrend, type HistoryEvent } from './getHistory'

describe('historyTrend', () => {
  const events = [
    { id: 'e-1', type: 'expense', date: new Date(2026, 8, 14, 9), amount: 120, label: 'Lunch' },
    { id: 'e-2', type: 'expense', date: new Date(2026, 8, 14, 19), amount: 80, label: 'Dinner' },
    { id: 'e-3', type: 'expense', date: new Date(2026, 8, 16, 9), amount: 50, label: 'Taxi' },
  ] as HistoryEvent[]

  it('totals the events per day of the week, and has nothing to plot for one day', () => {
    const trend = historyTrend(events, 'week', new Date(2026, 8, 15, 12))

    expect(trend?.totals).toEqual([200, 0, 50, 0, 0, 0, 0])
    expect(historyTrend(events, 'day', new Date(2026, 8, 15, 12))).toBeNull()
  })
})

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
      listMovements: vi.fn().mockResolvedValue([]),
      createMovement: vi.fn(),
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
      listMovements: vi.fn().mockResolvedValue([]),
      createMovement: vi.fn(),
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
