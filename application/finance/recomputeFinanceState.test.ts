import { describe, expect, it, vi } from 'vitest'
import { recomputeFinanceState } from './recomputeFinanceState'


describe('recomputeFinanceState', () => {
  it('uses the daily-use rate for the daily view and the monthly total for the monthly view', async () => {
    const repository = {
      listIncomes: vi.fn().mockResolvedValue([
        { id: 'income-1', amount: 5000 },
      ]),
      listAllocations: vi.fn().mockResolvedValue([
        { id: 'alloc-1', amount: 2000, period: 'monthly', category: 'daily_living' },
        { id: 'alloc-2', amount: 1500, period: 'monthly', category: 'fixed' },
      ]),
      listExpenses: vi.fn().mockResolvedValue([
        {
          id: 'expense-1',
          amount: 1800,
          category: 'food',
          description: 'Lunch',
          date: new Date('2026-09-15'),
          project: { id: 'project-1', name: 'Weekend trip' },
        },
        { id: 'expense-2', amount: 400, category: 'transportation', description: 'Taxi', date: new Date('2026-08-20') },
      ]),
      listSavings: vi.fn().mockResolvedValue([
        { id: 'saving-1', amount: 250, destination: 'savings' },
        { id: 'saving-2', amount: 150, destination: 'buffer' },
      ]),
      listBudgetExceptions: vi.fn().mockResolvedValue([
        { id: 'exception-1' },
      ]),
      createExpense: vi.fn(),
      createSaving: vi.fn(),
      createBudgetException: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: new Date('2026-09-15'),
      repository,
    })

    expect(state.incomeTotal).toBe(5000)
    expect(state.allocationTotal).toBe(3500)
    expect(state.dailyLivingAllocation).toBe(2000)
    expect(state.dailyBudget).toBe(2000)
    expect(state.periodBudget).toBe(2000 * 30)
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
  })

  it('treats today\'s transferred weekly buffer as already saved so the day is fully cleared', async () => {
    const repository = {
      listIncomes: vi.fn().mockResolvedValue([{ id: 'income-1', amount: 5000 }]),
      listAllocations: vi.fn().mockResolvedValue([
        { id: 'alloc-1', amount: 2000, period: 'monthly', category: 'daily_living' },
      ]),
      listExpenses: vi.fn().mockResolvedValue([
        { id: 'expense-1', amount: 1200, category: 'food', description: 'Lunch', date: new Date('2026-09-15') },
      ]),
      listSavings: vi.fn().mockResolvedValue([
        { id: 'saving-1', amount: 800, destination: 'buffer', date: new Date('2026-09-15') },
      ]),
      listBudgetExceptions: vi.fn().mockResolvedValue([]),
      createExpense: vi.fn(),
      createSaving: vi.fn(),
      createBudgetException: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: new Date('2026-09-15'),
      repository,
    })

    expect(state.dailySpent).toBe(1200)
    expect(state.dailyRemaining).toBe(0)
    expect(state.dailySaving).toBe(0)
    expect(state.buffer).toBe(800)
  })

  it('reduces the displayed buffer when money is transferred to actual savings', async () => {
    const repository = {
      listIncomes: vi.fn().mockResolvedValue([{ id: 'income-1', amount: 5000 }]),
      listAllocations: vi.fn().mockResolvedValue([
        { id: 'alloc-1', amount: 2000, period: 'monthly', category: 'daily_living' },
      ]),
      listExpenses: vi.fn().mockResolvedValue([
        { id: 'expense-1', amount: 1200, category: 'food', description: 'Lunch', date: new Date('2026-09-15') },
      ]),
      listSavings: vi.fn().mockResolvedValue([
        { id: 'saving-1', amount: 800, destination: 'buffer', date: new Date('2026-09-15') },
        { id: 'saving-2', amount: 200, source: 'buffer_transfer', destination: 'savings', date: new Date('2026-09-15') },
      ]),
      listBudgetExceptions: vi.fn().mockResolvedValue([]),
      createExpense: vi.fn(),
      createSaving: vi.fn(),
      createBudgetException: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const state = await recomputeFinanceState({
      userId: 'user-1',
      referenceDate: new Date('2026-09-15'),
      repository,
    })

    expect(state.buffer).toBe(600)
    expect(state.actualSavings).toBe(200)
  })
})
