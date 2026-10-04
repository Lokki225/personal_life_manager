import { describe, expect, it, vi } from 'vitest'

import { consolidateBuffer } from './consolidateBuffer'
import { createChest } from './createChest'
import { createCustomGoal } from './createCustomGoal'
import { createSavingsGoal } from './createSavingsGoal'
import { deleteChest } from './deleteChest'
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
  const deps = () => ({
    listChests: vi.fn().mockResolvedValue([{ name: 'Buffer' }]),
    create: vi.fn().mockResolvedValue({ id: 'goal-1' }),
  })

  it('hands the chest, the goal and the first contribution to one atomic write', async () => {
    const d = deps()

    await createSavingsGoal('user-1', { name: ' Headphones ', targetAmount: 30000, alreadySaved: 8000 }, d as never)

    expect(d.create).toHaveBeenCalledTimes(1)
    expect(d.create).toHaveBeenCalledWith('user-1', {
      name: 'Headphones',
      targetAmount: 30000,
      alreadySaved: 8000,
      unit: 'XOF',
    })
  })

  it('treats a missing first contribution as zero', async () => {
    const d = deps()

    await createSavingsGoal('user-1', { name: 'Headphones', targetAmount: 30000 }, d as never)

    expect(d.create).toHaveBeenCalledWith('user-1', expect.objectContaining({ alreadySaved: 0 }))
  })

  it('refuses a name already used by a chest, and a target of zero', async () => {
    const d = deps()

    await expect(
      createSavingsGoal('user-1', { name: 'buffer', targetAmount: 30000 }, d as never),
    ).rejects.toMatchObject({ field: 'name' })
    await expect(
      createSavingsGoal('user-1', { name: 'Phone', targetAmount: 0 }, d as never),
    ).rejects.toMatchObject({ field: 'targetAmount' })
    expect(d.create).not.toHaveBeenCalled()
  })
})

describe('createCustomGoal', () => {
  const deps = () => ({
    listChests: vi.fn().mockResolvedValue([{ id: 'base' }]),
    createGoal: vi.fn().mockResolvedValue({ id: 'goal-1' }),
  })

  it('builds each condition with its unit', async () => {
    const d = deps()

    await createCustomGoal(
      'user-1',
      {
        name: 'Disciplined month',
        logic: 'ALL',
        conditions: [
          { measurement: 'chest_balance', operator: 'GTE', targetValue: 50000, chestId: 'base' },
          { measurement: 'monthly_deviation_count', operator: 'LTE', targetValue: 3, chestId: 'ignored' },
        ],
      },
      d as never,
    )

    expect(d.createGoal).toHaveBeenCalledWith('user-1', {
      name: 'Disciplined month',
      domain: 'finance',
      logic: 'ALL',
      conditions: [
        { measurement: 'chest_balance', operator: 'GTE', targetValue: 50000, chestId: 'base', category: null, unit: 'XOF' },
        {
          measurement: 'monthly_deviation_count',
          operator: 'LTE',
          targetValue: 3,
          chestId: null,
          category: null,
          unit: null,
        },
      ],
    })
  })

  it('keeps the category of a category spending, and asks for one', async () => {
    const d = deps()
    const goal = (category?: string) =>
      createCustomGoal(
        'user-1',
        {
          name: 'Less transport',
          logic: 'ALL',
          conditions: [{ measurement: 'monthly_category_spending', operator: 'LTE', targetValue: 30000, category }],
        },
        d as never,
      )

    await goal('transport')
    expect(d.createGoal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        conditions: [expect.objectContaining({ category: 'transport', chestId: null, unit: 'XOF' })],
      }),
    )
    await expect(goal(undefined)).rejects.toMatchObject({ field: 'conditions.0.category' })
    await expect(goal('rockets')).rejects.toMatchObject({ field: 'conditions.0.category' })
  })

  it('points at the condition whose chest is missing or not the user\u2019s', async () => {
    const d = deps()
    const attempt = (chestId: string | undefined) =>
      createCustomGoal(
        'user-1',
        {
          name: 'Goal',
          logic: 'ANY',
          conditions: [
            { measurement: 'monthly_deviation_amount', operator: 'LTE', targetValue: 5000 },
            { measurement: 'chest_balance', operator: 'GTE', targetValue: 1000, chestId },
          ],
        },
        d as never,
      )

    await expect(attempt(undefined)).rejects.toMatchObject({ field: 'conditions.1.chestId' })
    await expect(attempt('someone-else')).rejects.toMatchObject({ field: 'conditions.1.chestId' })
    expect(d.createGoal).not.toHaveBeenCalled()
  })
})

describe('deleteChest', () => {
  const holidays = { id: 'holidays', name: 'Holidays', isSystem: false, balance: 0 }
  const deps = (chests: (typeof holidays)[], goals: { name: string; conditions: { chestId: string }[] }[] = []) => ({
    listChests: vi.fn().mockResolvedValue(chests),
    listGoals: vi.fn().mockResolvedValue(goals),
    remove: vi.fn(),
  })

  it('removes an empty chest of the user', async () => {
    const d = deps([holidays])

    await deleteChest('user-1', 'holidays', d)

    expect(d.remove).toHaveBeenCalledWith('user-1', 'holidays')
  })

  it('refuses a built-in chest, a chest holding money, and a chest a goal depends on', async () => {
    const builtIn = { id: 'buffer', name: 'Buffer', isSystem: true, balance: 0 }
    const funded = { ...holidays, balance: 2500 }
    const goal = { name: 'Trip', conditions: [{ chestId: 'holidays' }] }

    const system = deps([builtIn])
    await expect(deleteChest('user-1', 'buffer', system)).rejects.toThrow('Built-in chests cannot be deleted.')

    const withMoney = deps([funded])
    await expect(deleteChest('user-1', 'holidays', withMoney)).rejects.toThrow('Move the 2,500 out of Holidays first.')

    const withGoal = deps([holidays], [goal])
    await expect(deleteChest('user-1', 'holidays', withGoal)).rejects.toThrow('Holidays is used by the goal "Trip".')

    const missing = deps([holidays])
    await expect(deleteChest('user-1', 'someone-else', missing)).rejects.toThrow('This chest no longer exists.')

    for (const d of [system, withMoney, withGoal, missing]) {
      expect(d.remove).not.toHaveBeenCalled()
    }
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
