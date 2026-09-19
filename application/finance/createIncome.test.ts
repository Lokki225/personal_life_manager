import { describe, expect, it, vi } from 'vitest'
import { createIncome } from './createIncome'


describe('createIncome', () => {
  it('defaults status to expected when no status is provided', async () => {
    const repository = {
      createIncome: vi.fn().mockResolvedValue({
        id: 'income-1',
        userId: 'user-1',
        source: 'Salary',
        amount: 5000,
        frequency: 'monthly',
        status: 'expected',
      }),
      listIncomes: vi.fn(),
      updateIncome: vi.fn(),
      deleteIncome: vi.fn(),
    }

    const result = await createIncome(
      {
        userId: 'user-1',
        source: 'Salary',
        amount: 5000,
        frequency: 'monthly',
        notes: 'Main salary',
      },
      repository,
    )

    expect(repository.createIncome).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        source: 'Salary',
        amount: 5000,
        status: 'expected',
        frequency: 'monthly',
      }),
    )
    expect(result.status).toBe('expected')
  })
})
