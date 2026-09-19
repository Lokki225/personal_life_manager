import { describe, expect, it, vi } from 'vitest'

import { createBudgetException } from './createBudgetException'

describe('createBudgetException', () => {
  it('creates the exception with a computed difference and metadata', async () => {
    const repository = {
      createBudgetException: vi.fn().mockResolvedValue({
        id: 'exception-1',
        userId: 'user-1',
        category: 'emergency',
        plannedAmount: 2000,
        actualAmount: 3500,
        difference: 1500,
        reason: 'Car repair',
      }),
      listBudgetExceptions: vi.fn(),
      updateBudgetException: vi.fn(),
      deleteBudgetException: vi.fn(),
    }

    const result = await createBudgetException(
      {
        userId: 'user-1',
        date: '2026-09-18',
        plannedAmount: 2000,
        actualAmount: 3500,
        category: 'emergency',
        reason: 'Car repair',
      },
      repository,
    )

    expect(repository.createBudgetException).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        plannedAmount: 2000,
        actualAmount: 3500,
        difference: 1500,
        category: 'emergency',
      }),
    )
    expect(result.reason).toBe('Car repair')
  })
})
