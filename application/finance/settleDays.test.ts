import { describe, expect, it, vi } from 'vitest'

import { isSettled, settleDays } from './settleDays'

// Monday 5 October 2026, mid-morning. Yesterday was Sunday the 4th.
const now = new Date(2026, 9, 5, 10)
const day = (date: number, hour = 12) => new Date(2026, 9, date, hour)

const chests = [
  { id: 'buffer', name: 'Buffer', isSystem: true, balance: 1000 },
  { id: 'base', name: 'Base Chest', isSystem: true, balance: 90000 },
]

const depsOf = (overrides: Record<string, unknown> = {}) => ({
  claim: vi.fn().mockResolvedValue(true),
  listIncomes: vi.fn().mockResolvedValue([{ createdAt: day(2, 9) }]),
  // 60,000 a month: 2,000 a day.
  listAllocations: vi.fn().mockResolvedValue([{ name: 'Bread', amount: 60000, period: 'monthly', category: 'daily_living' }]),
  listExpenses: vi.fn().mockResolvedValue([
    { amount: 1500, date: day(2) },
    { amount: 400, date: day(3) },
    { amount: 2600, date: day(4) },
  ]),
  listMovements: vi.fn().mockResolvedValue([{ reason: 'DAILY_SAVING', amount: 500, date: day(2, 20) }]),
  listChests: vi.fn().mockResolvedValue(chests),
  createMovement: vi.fn(),
  ...overrides,
})

const written = (deps: ReturnType<typeof depsOf>) =>
  deps.createMovement.mock.calls.map(([, movement]) => [movement.reason, movement.amount, movement.date])

describe('isSettled', () => {
  it('is true once yesterday is settled', () => {
    expect(isSettled(new Date(2026, 9, 4), now)).toBe(true)
    expect(isSettled(new Date(2026, 9, 3), now)).toBe(false)
    expect(isSettled(null, now)).toBe(false)
  })
})

describe('settleDays', () => {
  it('puts what was left of each ended day into the Buffer, from the day the plan was set up', async () => {
    const deps = depsOf()

    // Sweep on Wednesday: none falls in these days.
    await settleDays({ id: 'user-1', settledThrough: null, bufferSweepDay: 3 }, now, deps as never)

    expect(deps.claim).toHaveBeenCalledWith('user-1', null, new Date(2026, 9, 4))
    expect(written(deps)).toEqual([
      // Friday: 2,000 − 1,500 spent − 500 already saved = nothing left.
      // Saturday: 2,000 − 400.
      ['DAILY_SAVING', 1600, new Date(2026, 9, 3, 23, 59, 59)],
      // Sunday went over: nothing.
    ])
    expect(deps.createMovement).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: 'IN', destinationChestId: 'buffer' }),
    )
  })

  it('empties the Buffer into the Base Chest when the chosen weekday begins', async () => {
    const deps = depsOf()

    // Sweep on Sunday: as the 4th begins, with the 1,000 it held plus Saturday's 1,600.
    await settleDays({ id: 'user-1', settledThrough: new Date(2026, 9, 2), bufferSweepDay: 0 }, now, deps as never)

    expect(written(deps)).toEqual([
      ['DAILY_SAVING', 1600, new Date(2026, 9, 3, 23, 59, 59)],
      ['BUFFER_CONSOLIDATION', 2600, new Date(2026, 9, 4)],
    ])
    expect(deps.createMovement).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({ type: 'TRANSFER', sourceChestId: 'buffer', destinationChestId: 'base' }),
    )
  })

  it('does nothing when already settled, when someone else settled first, or without a plan', async () => {
    const settled = depsOf()
    await settleDays({ id: 'user-1', settledThrough: new Date(2026, 9, 4), bufferSweepDay: 0 }, now, settled as never)
    expect(settled.claim).not.toHaveBeenCalled()

    const raced = depsOf({ claim: vi.fn().mockResolvedValue(false) })
    await settleDays({ id: 'user-1', settledThrough: null, bufferSweepDay: 0 }, now, raced as never)
    expect(raced.createMovement).not.toHaveBeenCalled()

    const noPlan = depsOf({ listIncomes: vi.fn().mockResolvedValue([]) })
    await settleDays({ id: 'user-1', settledThrough: null, bufferSweepDay: 0 }, now, noPlan as never)
    expect(noPlan.claim).not.toHaveBeenCalled()
    expect(noPlan.createMovement).not.toHaveBeenCalled()
  })

  it('puts nothing aside for a 31st, whose budget comes out of the chests', async () => {
    const deps = depsOf({ listExpenses: vi.fn().mockResolvedValue([]), listMovements: vi.fn().mockResolvedValue([]) })

    await settleDays(
      { id: 'user-1', settledThrough: new Date(2026, 9, 29), bufferSweepDay: 3 },
      new Date(2026, 10, 1, 10),
      deps as never,
    )

    // The 30th gives its 2,000; the 31st gives nothing.
    expect(written(deps)).toEqual([['DAILY_SAVING', 2000, new Date(2026, 9, 30, 23, 59, 59)]])
  })
})
