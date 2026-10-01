import { describe, expect, it, vi } from 'vitest'

import { consolidateBuffer } from './consolidateBuffer'
import { createChest } from './createChest'
import { createSavingsGoal } from './createSavingsGoal'
import { fundGoal } from './fundGoal'
import { transferBetweenChests } from './transferBetweenChests'

const today = new Date(2026, 9, 1)

const chest = (overrides: Record<string, unknown>) =>
  ({ id: 'chest', name: 'Chest', type: 'AVAILABLE', isSystem: false, lockedUntil: null, balance: 0, ...overrides }) as never

const buffer = chest({ id: 'buffer', name: 'Buffer', isSystem: true, balance: 1500 })
const base = chest({ id: 'base', name: 'Base Chest', isSystem: true, balance: 200 })
const locked = chest({ id: 'locked', name: 'House', type: 'SECURE', lockedUntil: new Date(2027, 0, 1), balance: 900 })

describe('createChest', () => {
  const repository = () => ({
    listChests: vi.fn().mockResolvedValue([{ name: 'Buffer' }]),
    createChest: vi.fn().mockResolvedValue({ id: 'new' }),
  })

  it('creates a chest, keeping the lock date only for a secure one', async () => {
    const repo = repository()
    const lockedUntil = new Date(2027, 0, 1)

    await createChest('user-1', { name: ' Holidays ', type: 'SECURE', lockedUntil }, repo as never, today)
    await createChest('user-1', { name: 'Car', type: 'AVAILABLE', lockedUntil }, repo as never, today)

    expect(repo.createChest).toHaveBeenNthCalledWith(1, 'user-1', {
      name: 'Holidays',
      type: 'SECURE',
      isSystem: false,
      lockedUntil,
    })
    expect(repo.createChest).toHaveBeenNthCalledWith(2, 'user-1', {
      name: 'Car',
      type: 'AVAILABLE',
      isSystem: false,
      lockedUntil: null,
    })
  })

  it('refuses a name already in use and a lock date in the past', async () => {
    const repo = repository()

    await expect(createChest('user-1', { name: 'buffer', type: 'AVAILABLE' }, repo as never, today)).rejects.toMatchObject({
      field: 'name',
    })
    await expect(
      createChest('user-1', { name: 'Old', type: 'SECURE', lockedUntil: new Date(2026, 0, 1) }, repo as never, today),
    ).rejects.toMatchObject({ field: 'lockedUntil' })
    expect(repo.createChest).not.toHaveBeenCalled()
  })
})

describe('transferBetweenChests', () => {
  const deps = () => ({ listChests: vi.fn().mockResolvedValue([buffer, base, locked]), record: vi.fn() })

  it('records one transfer movement between two of the user’s chests', async () => {
    const d = deps()

    await transferBetweenChests('user-1', 'buffer', 'base', 500, 'WITHDRAWAL', d as never, today)

    expect(d.record).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'TRANSFER',
      reason: 'WITHDRAWAL',
      sourceChestId: 'buffer',
      destinationChestId: 'base',
      amount: 500,
    })
  })

  it('refuses the same chest, a foreign chest, a locked chest and more than the balance', async () => {
    const d = deps()
    const attempt = (source: string, destination: string, amount: number) =>
      transferBetweenChests('user-1', source, destination, amount, 'WITHDRAWAL', d as never, today)

    await expect(attempt('buffer', 'buffer', 10)).rejects.toMatchObject({ field: 'destinationChestId' })
    await expect(attempt('someone-else', 'base', 10)).rejects.toMatchObject({ field: 'sourceChestId' })
    await expect(attempt('buffer', 'someone-else', 10)).rejects.toMatchObject({ field: 'destinationChestId' })
    await expect(attempt('locked', 'base', 10)).rejects.toMatchObject({ field: 'sourceChestId' })
    await expect(attempt('buffer', 'base', 1501)).rejects.toMatchObject({
      field: 'amount',
      message: 'Buffer only holds 1,500.',
    })
    expect(d.record).not.toHaveBeenCalled()
  })
})

describe('consolidateBuffer', () => {
  it('moves the whole buffer into the Base Chest', async () => {
    const deps = { listChests: vi.fn().mockResolvedValue([buffer, base]), transfer: vi.fn() }

    await expect(consolidateBuffer('user-1', null, deps as never)).resolves.toEqual({ consolidated: 1500 })
    expect(deps.transfer).toHaveBeenCalledWith('user-1', 'buffer', 'base', 1500, 'BUFFER_CONSOLIDATION')
  })

  it('refuses when the buffer is empty', async () => {
    const empty = chest({ id: 'buffer', name: 'Buffer', isSystem: true, balance: 0 })
    const deps = { listChests: vi.fn().mockResolvedValue([empty, base]), transfer: vi.fn() }

    await expect(consolidateBuffer('user-1', null, deps as never)).rejects.toThrow('The Buffer is empty')
    expect(deps.transfer).not.toHaveBeenCalled()
  })
})

describe('createSavingsGoal', () => {
  it('creates a chest, a goal on its balance, and the first contribution', async () => {
    const deps = {
      createChest: vi.fn().mockResolvedValue({ id: 'goal-chest' }),
      createGoal: vi.fn().mockResolvedValue({ id: 'goal-1' }),
      record: vi.fn(),
    }

    await createSavingsGoal('user-1', { name: 'Headphones', targetAmount: 30000, alreadySaved: 8000 }, deps as never)

    expect(deps.createChest).toHaveBeenCalledWith('user-1', { name: 'Headphones', type: 'AVAILABLE' })
    expect(deps.createGoal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Headphones',
        conditions: [expect.objectContaining({ chestId: 'goal-chest', operator: 'GTE', targetValue: 30000 })],
      }),
    )
    expect(deps.record).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8000, destinationChestId: 'goal-chest', relatedGoalId: 'goal-1' }),
    )
  })

  it('records no contribution when nothing was saved yet', async () => {
    const deps = {
      createChest: vi.fn().mockResolvedValue({ id: 'goal-chest' }),
      createGoal: vi.fn().mockResolvedValue({ id: 'goal-1' }),
      record: vi.fn(),
    }

    await createSavingsGoal('user-1', { name: 'Headphones', targetAmount: 30000 }, deps as never)

    expect(deps.record).not.toHaveBeenCalled()
  })
})

describe('fundGoal', () => {
  const goal = { id: 'goal-1', userId: 'user-1', conditions: [{ measurement: 'chest_balance', chestId: 'goal-chest' }] }

  it('transfers from the chosen chest into the goal chest', async () => {
    const deps = { getGoal: vi.fn().mockResolvedValue(goal), transfer: vi.fn() }

    await fundGoal('user-1', 'goal-1', 500, 'buffer', deps as never)

    expect(deps.transfer).toHaveBeenCalledWith('user-1', 'buffer', 'goal-chest', 500, 'GOAL_FUNDING')
  })

  it('refuses a goal that belongs to someone else', async () => {
    const deps = { getGoal: vi.fn().mockResolvedValue({ ...goal, userId: 'other' }), transfer: vi.fn() }

    await expect(fundGoal('user-1', 'goal-1', 500, 'buffer', deps as never)).rejects.toMatchObject({ field: 'goalId' })
    expect(deps.transfer).not.toHaveBeenCalled()
  })
})
