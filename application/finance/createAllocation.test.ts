import { describe, expect, it, vi } from 'vitest'

import { createAllocation, getCurrentAllocations } from './createAllocation'

describe('createAllocation', () => {
  it('stores allocation data when creating a new allocation', async () => {
    const repository = {
      createAllocation: vi.fn().mockResolvedValue({
        id: 'allocation-1',
        userId: 'user-1',
        name: 'Housing',
        amount: 2500,
        period: 'monthly',
        category: 'fixed',
        startDate: new Date('2026-01-01'),
        endDate: null,
      }),
      listAllocations: vi.fn(),
      updateAllocation: vi.fn(),
      deleteAllocation: vi.fn(),
    }

    const result = await createAllocation(
      {
        userId: 'user-1',
        name: 'Housing',
        amount: 2500,
        period: 'monthly',
        category: 'fixed',
        startDate: '2026-01-01',
      },
      repository,
    )

    expect(repository.createAllocation).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Housing',
        amount: 2500,
        category: 'fixed',
        period: 'monthly',
      }),
    )
    expect(result.name).toBe('Housing')
  })
})

describe('getCurrentAllocations', () => {
  it('returns only allocations active on the selected date', async () => {
    const repository = {
      createAllocation: vi.fn(),
      listAllocations: vi.fn().mockResolvedValue([
        {
          id: 'active-1',
          userId: 'user-1',
          name: 'Housing',
          amount: 2500,
          period: 'monthly',
          category: 'fixed',
          startDate: new Date('2026-01-01'),
          endDate: null,
        },
        {
          id: 'inactive-1',
          userId: 'user-1',
          name: 'Old plan',
          amount: 300,
          period: 'monthly',
          category: 'custom',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        },
        {
          id: 'future-1',
          userId: 'user-1',
          name: 'Future plan',
          amount: 400,
          period: 'monthly',
          category: 'custom',
          startDate: new Date('2026-03-01'),
          endDate: null,
        },
      ]),
      updateAllocation: vi.fn(),
      deleteAllocation: vi.fn(),
    }

    const result = await getCurrentAllocations('user-1', new Date('2026-02-10'), repository)

    expect(result.map((allocation) => allocation.id)).toEqual(['active-1'])
  })
})
