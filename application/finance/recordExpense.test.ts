import { describe, expect, it, vi } from 'vitest'

import { recordExpense } from './recordExpense'

describe('recordExpense', () => {
  it('stores the expense under the given user with the expected payload', async () => {
    const repository = {
      createExpense: vi.fn().mockResolvedValue({
        id: 'expense-1',
        userId: 'user-1',
        amount: 1500,
        category: 'food',
        date: new Date('2026-09-18'),
        description: 'Groceries',
      }),
      listExpenses: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
    }

    const result = await recordExpense(
      {
        userId: 'user-1',
        amount: 1500,
        category: 'food',
        date: '2026-09-18',
        description: 'Groceries',
      },
      repository,
    )

    expect(repository.createExpense).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 1500,
        category: 'food',
        description: 'Groceries',
      }),
    )
    expect(result.description).toBe('Groceries')
  })
})
