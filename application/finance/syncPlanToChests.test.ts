import { describe, expect, it, vi } from 'vitest'

import { syncPlanToChests } from './syncPlanToChests'

const now = new Date(2026, 9, 2, 12)

const base = { id: 'base', name: 'Base Chest', type: 'AVAILABLE', isSystem: true, lockedUntil: null, balance: 190000 }
const monthly = { id: 'monthly', name: 'Monthly Savings', type: 'SECURE', isSystem: false, lockedUntil: null, balance: 0 }

const living = { amount: 60000, period: 'monthly', category: 'daily_living' }
const bills = { amount: 50000, period: 'monthly', category: 'fixed' }
const saving = { amount: 100000, period: 'monthly', category: 'savings' }

// What setup placed: 190,000 of unallocated income in the Base Chest.
const setupDeposit = {
  reason: 'PLANNED_SAVING',
  date: new Date(2026, 9, 2, 9),
  amount: 190000,
  sourceChestId: null,
  destinationChestId: 'base',
}

const depsOf = (allocations: unknown[], overrides: Record<string, unknown> = {}) => ({
  listAllocations: vi.fn().mockResolvedValue(allocations),
  listReceipts: vi.fn().mockResolvedValue([{ amount: 300000 }]),
  listChests: vi.fn().mockResolvedValue([base, monthly]),
  listMovements: vi.fn().mockResolvedValue([setupDeposit]),
  record: vi.fn(),
  ...overrides,
})

const moves = (deps: ReturnType<typeof depsOf>) =>
  deps.record.mock.calls.map(([movement]) => [movement.type, movement.amount, movement.sourceChestId, movement.destinationChestId])

describe('syncPlanToChests', () => {
  it('moves nothing when the chests already match the plan', async () => {
    const deps = depsOf([living, bills])

    await syncPlanToChests('user-1', now, deps as never)

    expect(deps.record).not.toHaveBeenCalled()
  })

  it('takes a new savings allocation out of the Base Chest, into Monthly Savings', async () => {
    const deps = depsOf([living, bills, saving])

    await syncPlanToChests('user-1', now, deps as never)

    expect(moves(deps)).toEqual([['TRANSFER', 100000, 'base', 'monthly']])
    expect(deps.record).toHaveBeenCalledWith(expect.objectContaining({ reason: 'PLANNED_SAVING', notes: 'Plan change' }))
  })

  it('takes a new spending allocation out of the Base Chest, and gives a removed one back', async () => {
    const added = depsOf([living, bills, { amount: 20000, period: 'monthly', category: 'fixed' }])
    await syncPlanToChests('user-1', now, added as never)
    expect(moves(added)).toEqual([['OUT', 20000, 'base', undefined]])

    const removed = depsOf([living])
    await syncPlanToChests('user-1', now, removed as never)
    expect(moves(removed)).toEqual([['IN', 50000, undefined, 'base']])
  })

  it('gives a removed savings allocation back to the Base Chest, unless the chest is locked', async () => {
    const afterSaving = [
      { ...setupDeposit, amount: 90000 },
      { ...setupDeposit, amount: 100000, destinationChestId: 'monthly' },
    ]
    const chests = [
      { ...base, balance: 90000 },
      { ...monthly, balance: 100000 },
    ]

    const deps = depsOf([living, bills], {
      listMovements: vi.fn().mockResolvedValue(afterSaving),
      listChests: vi.fn().mockResolvedValue(chests),
    })
    await syncPlanToChests('user-1', now, deps as never)
    expect(moves(deps)).toEqual([['TRANSFER', 100000, 'monthly', 'base']])

    const locked = depsOf([living, bills], {
      listMovements: vi.fn().mockResolvedValue(afterSaving),
      listChests: vi.fn().mockResolvedValue([chests[0], { ...chests[1], lockedUntil: new Date(2026, 11, 31) }]),
    })
    await syncPlanToChests('user-1', now, locked as never)
    expect(moves(locked)).toEqual([['IN', 100000, undefined, 'base']])
  })

  it('never takes more than the Base Chest holds', async () => {
    const deps = depsOf([living, bills, saving], {
      listChests: vi.fn().mockResolvedValue([{ ...base, balance: 60000 }, monthly]),
    })

    await syncPlanToChests('user-1', now, deps as never)

    expect(moves(deps)).toEqual([['TRANSFER', 60000, 'base', 'monthly']])
  })

  it('does nothing before any income is counted for the month', async () => {
    const deps = depsOf([living, bills, saving], { listReceipts: vi.fn().mockResolvedValue([]) })

    await syncPlanToChests('user-1', now, deps as never)

    expect(deps.record).not.toHaveBeenCalled()
  })
})
