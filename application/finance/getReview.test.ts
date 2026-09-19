import { describe, expect, it, vi } from 'vitest'

import { getReview } from './getReview'

describe('getReview', () => {
  it('summarizes the selected period and groups exceptions by category', async () => {
    const repository = {
      listExpenses: vi.fn().mockResolvedValue([
        { id: 'e-1', amount: 120, category: 'food', description: 'Lunch', date: new Date('2026-09-10T09:00:00Z') },
        { id: 'e-2', amount: 80, category: 'food', description: 'Dinner', date: new Date('2026-09-12T09:00:00Z') },
        { id: 'e-3', amount: 220, category: 'transportation', description: 'Train', date: new Date('2026-09-14T09:00:00Z') },
      ]),
      listSavings: vi.fn().mockResolvedValue([
        { id: 's-1', amount: 150, destination: 'savings', date: new Date('2026-09-15T09:00:00Z') },
      ]),
      listBudgetExceptions: vi.fn().mockResolvedValue([
        { id: 'x-1', category: 'food', difference: 45, date: new Date('2026-09-11T09:00:00Z') },
        { id: 'x-2', category: 'transportation', difference: 70, date: new Date('2026-09-14T09:00:00Z') },
      ]),
      listIncomes: vi.fn().mockResolvedValue([{ id: 'i-1', amount: 5000, date: new Date('2026-09-01T09:00:00Z') }]),
      listAllocations: vi.fn().mockResolvedValue([
        { id: 'a-1', amount: 2500, category: 'daily_living', period: 'monthly', name: 'Daily life' },
        { id: 'a-2', amount: 500, category: 'fixed', period: 'monthly', name: 'Rent' },
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

    const review = await getReview({
      userId: 'user-1',
      period: 'month',
      referenceDate: new Date('2026-09-15T09:00:00Z'),
      repository,
    })

    expect(review.period).toBe('month')
    expect(review.actualSpent).toBe(420)
    expect(review.actualSavings).toBe(150)
    expect(review.categoryBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'food', total: 200 }),
        expect.objectContaining({ category: 'transportation', total: 220 }),
      ]),
    )
    expect(review.exceptionBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'food', total: 45 }),
        expect.objectContaining({ category: 'transportation', total: 70 }),
      ]),
    )
  })
})
