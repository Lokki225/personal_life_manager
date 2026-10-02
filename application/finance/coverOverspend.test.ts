import { describe, expect, it, vi } from 'vitest'

import { coverOverspend } from './coverOverspend'

const depsOf = (state: { dailyOverspend: number; uncoveredDay?: boolean; buffer?: number }) => ({
  getToday: vi.fn().mockResolvedValue({
    dailyOverspend: state.dailyOverspend,
    uncoveredDay: state.uncoveredDay ?? false,
    chests: [
      { id: 'buffer', name: 'Buffer', isSystem: true, balance: state.buffer ?? 1000 },
      { id: 'base', name: 'Base Chest', isSystem: true, balance: 90000 },
    ],
  }),
  record: vi.fn(),
})

describe('coverOverspend', () => {
  it('takes the overspend out of the Buffer', async () => {
    const deps = depsOf({ dailyOverspend: 500 })

    await expect(coverOverspend('user-1', deps)).resolves.toBe(500)
    expect(deps.record).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 500,
      type: 'OUT',
      reason: 'EXPENSE',
      sourceChestId: 'buffer',
      notes: 'Covered overspend',
    })
  })

  it('covers only as much as the Buffer holds', async () => {
    const deps = depsOf({ dailyOverspend: 1800, buffer: 1000.9 })

    await expect(coverOverspend('user-1', deps)).resolves.toBe(1000)
  })

  it('refuses when the day is within budget, on a 31st, or when the Buffer is empty', async () => {
    await expect(coverOverspend('user-1', depsOf({ dailyOverspend: 0 }))).rejects.toThrow(
      'Today is within budget, so there is nothing to cover.',
    )
    await expect(coverOverspend('user-1', depsOf({ dailyOverspend: 500, uncoveredDay: true }))).rejects.toThrow(
      'Today is within budget, so there is nothing to cover.',
    )

    const empty = depsOf({ dailyOverspend: 500, buffer: 0 })
    await expect(coverOverspend('user-1', empty)).rejects.toThrow('The Buffer is empty.')
    expect(empty.record).not.toHaveBeenCalled()
  })
})
