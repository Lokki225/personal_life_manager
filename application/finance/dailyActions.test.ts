import { describe, expect, it, vi } from 'vitest'

import { FinanceRuleError } from '../../domain/finance/errors'
import { recordDailyException } from './recordDailyException'
import { saveDailyRemaining } from './saveDailyRemaining'

const buffer = { id: 'buffer', name: 'Buffer', isSystem: true }
const savings = { id: 'savings', name: 'Monthly Savings', isSystem: false }

const savingDeps = (available: number, chests = [buffer, savings]) => ({
  getAvailable: vi.fn().mockResolvedValue(available),
  listChests: vi.fn().mockResolvedValue(chests),
  ensureChests: vi.fn(),
  record: vi.fn(),
})

describe('saveDailyRemaining', () => {
  it('saves to the chosen chest', async () => {
    const deps = savingDeps(800)

    await saveDailyRemaining({ userId: 'user-1', amount: 500, destinationChestId: 'savings' }, deps)

    expect(deps.record).toHaveBeenCalledWith('user-1', 500, 'savings')
  })

  it('falls back to the Buffer, creating the default chests for a new user', async () => {
    const deps = savingDeps(800)
    deps.listChests.mockResolvedValueOnce([]).mockResolvedValueOnce([buffer])

    await saveDailyRemaining({ userId: 'user-1', amount: 800 }, deps)

    expect(deps.ensureChests).toHaveBeenCalledWith('user-1')
    expect(deps.record).toHaveBeenCalledWith('user-1', 800, 'buffer')
  })

  it('refuses more than what is left today, on the amount field', async () => {
    const deps = savingDeps(800)

    await expect(saveDailyRemaining({ userId: 'user-1', amount: 801 }, deps)).rejects.toMatchObject({
      message: 'You can save at most 800 today.',
      field: 'amount',
    })
    expect(deps.record).not.toHaveBeenCalled()
  })

  it('refuses when nothing is left, and a chest that is not the user’s', async () => {
    await expect(saveDailyRemaining({ userId: 'user-1', amount: 10 }, savingDeps(0))).rejects.toThrow(
      'There is nothing left to save today.',
    )
    await expect(
      saveDailyRemaining({ userId: 'user-1', amount: 10, destinationChestId: 'someone-else' }, savingDeps(800)),
    ).rejects.toMatchObject({ field: 'destinationChestId' })
  })
})

describe('recordDailyException', () => {
  const today = new Date(2026, 8, 15)

  it('records the overspend from the real figures of the day', async () => {
    const deps = {
      getToday: vi.fn().mockResolvedValue({
        dailyBudget: 2000,
        dailySpent: 2600,
        dailyOverspend: 600,
        overspendExplained: false,
      }),
      listExceptions: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn(),
    }

    await recordDailyException({ userId: 'user-1', category: 'food', reason: 'Dinner out' }, deps, today)

    expect(deps.create).toHaveBeenCalledWith({
      userId: 'user-1',
      date: today,
      plannedAmount: 2000,
      actualAmount: 2600,
      difference: 600,
      category: 'food',
      reason: 'Dinner out',
      resolution: 'Review next cycle',
    })
  })

  it('refuses when the day is within budget', async () => {
    const deps = {
      getToday: vi.fn().mockResolvedValue({
        dailyBudget: 2000,
        dailySpent: 1500,
        dailyOverspend: 0,
        overspendExplained: false,
      }),
      listExceptions: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn(),
    }

    await expect(recordDailyException({ userId: 'user-1', category: 'food' }, deps, today)).rejects.toThrow(
      FinanceRuleError,
    )
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('refuses a second explanation for the same day', async () => {
    const deps = {
      getToday: vi.fn().mockResolvedValue({
        dailyBudget: 2000,
        dailySpent: 2600,
        dailyOverspend: 600,
        overspendExplained: true,
      }),
      listExceptions: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn(),
    }

    await expect(recordDailyException({ userId: 'user-1', category: 'food' }, deps, today)).rejects.toThrow(
      "Today's overspend is already explained.",
    )
    expect(deps.create).not.toHaveBeenCalled()
  })
  it('gives its cause to an overspend recorded without one, instead of counting it twice', async () => {
    const deps = {
      getToday: vi.fn().mockResolvedValue({
        dailyBudget: 2000,
        dailySpent: 2600,
        dailyOverspend: 600,
        overspendExplained: false,
      }),
      listExceptions: vi.fn().mockResolvedValue([
        { id: 'waiting', date: new Date(2026, 8, 15, 12), category: 'unexplained' },
        { id: 'yesterday', date: new Date(2026, 8, 14, 12), category: 'unexplained' },
      ]),
      update: vi.fn(),
      create: vi.fn(),
    }

    await recordDailyException({ userId: 'user-1', category: 'food', reason: 'Dinner out' }, deps, today)

    expect(deps.update).toHaveBeenCalledTimes(1)
    expect(deps.update).toHaveBeenCalledWith('user-1', 'waiting', { category: 'food', reason: 'Dinner out' })
    expect(deps.create).not.toHaveBeenCalled()
  })
})
