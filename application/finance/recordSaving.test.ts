import { describe, expect, it, vi } from 'vitest'

import { recordSaving } from './recordSaving'

describe('recordSaving', () => {
  it('stores the saving record with the proper metadata', async () => {
    const repository = {
      createSaving: vi.fn().mockResolvedValue({
        id: 'saving-1',
        userId: 'user-1',
        amount: 400,
        date: new Date('2026-09-18'),
        source: 'underspending',
        destination: 'savings',
      }),
      listSavings: vi.fn(),
      updateSaving: vi.fn(),
      deleteSaving: vi.fn(),
    }

    const result = await recordSaving(
      {
        userId: 'user-1',
        amount: 400,
        date: '2026-09-18',
        source: 'underspending',
        destination: 'savings',
        notes: 'Saved leftover budget',
      },
      repository,
    )

    expect(repository.createSaving).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 400,
        source: 'underspending',
        destination: 'savings',
      }),
    )
    expect(result.destination).toBe('savings')
  })
})
