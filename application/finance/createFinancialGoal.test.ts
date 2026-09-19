import { describe, expect, it, vi } from 'vitest'

import { createFinancialGoal } from './createFinancialGoal'

describe('createFinancialGoal', () => {
  it('creates a goal for the user with the target amount and initial progress', async () => {
    const repository = {
      createFinancialGoal: vi.fn().mockResolvedValue({
        id: 'goal-1',
        userId: 'user-1',
        name: 'Emergency fund',
        targetAmount: 10000,
        currentAmount: 1500,
      }),
      listFinancialGoals: vi.fn(),
      updateFinancialGoal: vi.fn(),
      deleteFinancialGoal: vi.fn(),
    }

    const result = await createFinancialGoal(
      {
        userId: 'user-1',
        name: 'Emergency fund',
        targetAmount: 10000,
        currentAmount: 1500,
      },
      repository,
    )

    expect(repository.createFinancialGoal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Emergency fund',
        targetAmount: 10000,
        currentAmount: 1500,
      }),
    )
    expect(result.name).toBe('Emergency fund')
    expect(result.targetAmount).toBe(10000)
  })
})
