import { describe, expect, it, vi } from 'vitest'

import { chestWithdrawalBlocker, isPaidFromChest } from '../../domain/finance/chests'
import { recordChestExpense } from './chestExpense'

const today = new Date(2026, 9, 4, 12)
const laptop = { id: 'laptop', name: 'Laptop', type: 'AVAILABLE', lockedUntil: null, balance: 400000 }
const trip = { id: 'trip', name: 'Trip', type: 'SECURE', lockedUntil: new Date(2026, 11, 31, 23, 59), balance: 90000 }

const depsOf = () => ({ listChests: vi.fn().mockResolvedValue([laptop, trip]), create: vi.fn() })

describe('chestWithdrawalBlocker', () => {
  it('lets a chest give what it holds', () => {
    expect(chestWithdrawalBlocker(laptop, 400000, today)).toBeNull()
  })

  it('refuses more than the chest holds, and a secure chest before its date', () => {
    expect(chestWithdrawalBlocker(laptop, 400001, today)).toEqual({ reason: 'short', message: 'Laptop only holds 400,000.' })
    expect(chestWithdrawalBlocker(trip, 10, today)).toEqual({ reason: 'locked', message: 'Trip is locked until 31/12/2026.' })
    expect(chestWithdrawalBlocker(trip, 10, new Date(2027, 0, 1))).toBeNull()
  })
})

describe('isPaidFromChest', () => {
  it('tells an expense paid from a chest from one paid by the day', () => {
    expect(isPaidFromChest({ paidFromChestName: 'Laptop' })).toBe(true)
    expect(isPaidFromChest({ paidFromChestName: null })).toBe(false)
    expect(isPaidFromChest({})).toBe(false)
  })
})

describe('recordChestExpense', () => {
  it('records the expense with the chest that pays for it', async () => {
    const deps = depsOf()

    await recordChestExpense(
      { userId: 'user-1', chestId: 'laptop', amount: 350000, category: 'shopping', description: ' New laptop ' },
      deps,
      today,
    )

    expect(deps.create).toHaveBeenCalledWith('user-1', {
      amount: 350000,
      category: 'shopping',
      description: 'New laptop',
      date: today,
      chestId: 'laptop',
      chestName: 'Laptop',
    })
  })

  it('refuses a chest that is not the person\'s, too short, or locked', async () => {
    const deps = depsOf()
    const pay = (chestId: string, amount: number) =>
      recordChestExpense({ userId: 'user-1', chestId, amount, category: 'other' }, deps, today)

    await expect(pay('someone-else', 10)).rejects.toThrow('Choose one of your chests.')
    await expect(pay('laptop', 500000)).rejects.toThrow('Laptop only holds 400,000.')
    await expect(pay('trip', 10)).rejects.toThrow('Trip is locked until 31/12/2026.')
    expect(deps.create).not.toHaveBeenCalled()
  })
})
