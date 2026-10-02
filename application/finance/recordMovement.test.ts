import { describe, expect, it, vi } from 'vitest'

import { recordMovement } from './recordMovement'

describe('recordMovement', () => {
  it('keeps the chest and goal links on the stored movement', async () => {
    const repository = { createMovement: vi.fn().mockResolvedValue({ id: 'movement-1' }) }

    await recordMovement(
      {
        userId: 'user-1',
        amount: 500,
        type: 'TRANSFER',
        reason: 'GOAL_FUNDING',
        sourceChestId: 'buffer',
        destinationChestId: 'goal-chest',
        relatedGoalId: 'goal-1',
        notes: 'Headphones',
      },
      repository,
    )

    expect(repository.createMovement).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 500,
        type: 'TRANSFER',
        reason: 'GOAL_FUNDING',
        sourceChestId: 'buffer',
        destinationChestId: 'goal-chest',
        relatedGoalId: 'goal-1',
        notes: 'Headphones',
      }),
    )
  })

  it('refuses amounts that are not positive and transfers missing a chest', async () => {
    const repository = { createMovement: vi.fn() }

    await expect(
      recordMovement({ userId: 'user-1', amount: 0, type: 'IN', reason: 'DAILY_SAVING' }, repository),
    ).rejects.toThrow('Movement amount must be positive')
    await expect(
      recordMovement(
        { userId: 'user-1', amount: 10, type: 'TRANSFER', reason: 'BUFFER_CONSOLIDATION', sourceChestId: 'a' },
        repository,
      ),
    ).rejects.toThrow('Transfer requires both a source and destination chest')
    expect(repository.createMovement).not.toHaveBeenCalled()
  })
})
