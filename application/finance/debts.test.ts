import { describe, expect, it, vi } from 'vitest'

import { listDebtsWithStatus, recordDebt, repayDebt } from './debts'

const today = new Date(2026, 8, 15, 10)

const chests = [
  { id: 'buffer', name: 'Buffer', isSystem: true, balance: 5000 },
  { id: 'base', name: 'Base Chest', isSystem: true, balance: 40000 },
  { id: 'debts', name: 'Debts Chest', isSystem: true, balance: 30000 },
  { id: 'holidays', name: 'Holidays', isSystem: false, balance: 90000 },
]

const debt = (overrides: Record<string, unknown> = {}) => ({
  id: 'debt-1',
  direction: 'BORROWED',
  counterparty: 'Awa',
  principal: 50000,
  interestType: 'PERCENT',
  interestValue: 10,
  takenAt: new Date(2026, 8, 1),
  dueDate: null,
  payments: [{ amount: 20000 }],
  ...overrides,
})

const depsOf = (debts: unknown[] = []) => ({
  listChests: vi.fn().mockResolvedValue(chests),
  listDebts: vi.fn().mockResolvedValue(debts),
  listGoals: vi.fn().mockResolvedValue([
    { id: 'trip', name: 'Trip', conditions: [{ measurement: 'chest_balance', chestId: 'trip-chest' }] },
    { id: 'calm', name: 'Calm month', conditions: [{ measurement: 'monthly_deviation_count', chestId: null }] },
  ]),
  createDebt: vi.fn(),
  addPayment: vi.fn(),
})

const borrow = { userId: 'user-1', direction: 'BORROWED' as const, counterparty: 'Awa', amount: 50000 }
const lend = { ...borrow, direction: 'LENT' as const, interestType: 'NONE' as const }

describe('listDebtsWithStatus', () => {
  it('adds the interest and takes off what was repaid', async () => {
    const [status] = await listDebtsWithStatus('user-1', depsOf([debt()]) as never)

    expect(status).toMatchObject({ principal: 50000, total: 55000, paid: 20000, outstanding: 35000 })
  })
})

describe('recordDebt', () => {
  it('always puts borrowed money into the Debts Chest', async () => {
    const deps = depsOf()

    await recordDebt({ ...borrow, interestType: 'PERCENT', interestValue: 10, chestId: 'base' }, deps as never, today)

    expect(deps.createDebt).toHaveBeenCalledWith(
      'user-1',
      {
        direction: 'BORROWED',
        counterparty: 'Awa',
        principal: 50000,
        interestType: 'PERCENT',
        interestValue: 10,
        takenAt: today,
        dueDate: null,
        goalId: null,
      },
      { type: 'IN', chestId: 'debts', notes: 'Borrowed from Awa' },
      null,
    )
  })

  it('sends money borrowed for a goal on to that goal’s chest', async () => {
    const deps = depsOf()

    await recordDebt({ ...borrow, interestType: 'NONE', goalId: 'trip' }, deps as never, today)

    expect(deps.createDebt).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ goalId: 'trip' }),
      { type: 'IN', chestId: 'debts', notes: 'Borrowed from Awa' },
      { goalId: 'trip', chestId: 'trip-chest' },
    )

    for (const goalId of ['calm', 'someone-else']) {
      await expect(
        recordDebt({ ...borrow, interestType: 'NONE', goalId }, deps as never, today),
      ).rejects.toMatchObject({ field: 'goalId' })
    }
    expect(deps.createDebt).toHaveBeenCalledTimes(1)
  })

  it('takes money lent out of the Buffer, the Base Chest or the Debts Chest only', async () => {
    const deps = depsOf()

    await recordDebt({ ...lend, amount: 30000, chestId: 'debts' }, deps as never, today)
    expect(deps.createDebt).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ direction: 'LENT' }),
      { type: 'OUT', chestId: 'debts', notes: 'Lent to Awa' },
      null,
    )

    await expect(recordDebt({ ...lend, chestId: 'base' }, deps as never, today)).rejects.toMatchObject({
      message: 'Base Chest only holds 40,000.',
      field: 'amount',
    })
    for (const chestId of ['holidays', 'someone-else', null]) {
      await expect(recordDebt({ ...lend, chestId }, deps as never, today)).rejects.toMatchObject({
        message: 'Choose the Buffer, the Base Chest or the Debts Chest.',
        field: 'chestId',
      })
    }
    expect(deps.createDebt).toHaveBeenCalledTimes(1)
  })

  it('asks for the interest when a type is chosen, and drops it when there is none', async () => {
    const deps = depsOf()

    await expect(
      recordDebt({ ...borrow, interestType: 'FIXED', interestValue: null }, deps as never, today),
    ).rejects.toMatchObject({ field: 'interestValue' })
    await expect(
      recordDebt({ ...borrow, interestType: 'PERCENT', interestValue: 150 }, deps as never, today),
    ).rejects.toMatchObject({ field: 'interestValue' })
    expect(deps.createDebt).not.toHaveBeenCalled()

    await recordDebt({ ...borrow, interestType: 'NONE', interestValue: 5 }, deps as never, today)
    expect(deps.createDebt).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ interestType: 'NONE', interestValue: 0 }),
      expect.anything(),
      null,
    )
  })
})

describe('repayDebt', () => {
  it('pays back a borrowed debt out of the chosen chest', async () => {
    const deps = depsOf([debt()])

    await repayDebt({ userId: 'user-1', debtId: 'debt-1', amount: 30000, chestId: 'debts' }, deps as never, today)

    expect(deps.addPayment).toHaveBeenCalledWith(
      'user-1',
      'debt-1',
      { amount: 30000, date: today },
      { type: 'OUT', chestId: 'debts', notes: 'Repaid Awa' },
    )
  })

  it('puts money lent that comes back into the Base Chest, whatever chest is sent', async () => {
    const deps = depsOf([debt({ direction: 'LENT', interestType: 'NONE', payments: [] })])

    await repayDebt({ userId: 'user-1', debtId: 'debt-1', amount: 50000, chestId: 'holidays' }, deps as never, today)

    expect(deps.addPayment).toHaveBeenCalledWith(
      'user-1',
      'debt-1',
      { amount: 50000, date: today },
      { type: 'IN', chestId: 'base', notes: 'Repaid by Awa' },
    )
  })

  it('refuses more than what is left, more than the chest holds, another chest, and a settled or unknown debt', async () => {
    const repay = { userId: 'user-1', debtId: 'debt-1', chestId: 'base' }

    await expect(repayDebt({ ...repay, amount: 35001 }, depsOf([debt()]) as never, today)).rejects.toMatchObject({
      message: 'Only 35,000 is left to repay.',
      field: 'amount',
    })
    await expect(
      repayDebt({ ...repay, amount: 45000 }, depsOf([debt({ payments: [] })]) as never, today),
    ).rejects.toMatchObject({ message: 'Base Chest only holds 40,000.', field: 'amount' })
    await expect(
      repayDebt({ ...repay, amount: 10, chestId: 'holidays' }, depsOf([debt()]) as never, today),
    ).rejects.toMatchObject({ field: 'chestId' })
    await expect(
      repayDebt({ ...repay, amount: 10 }, depsOf([debt({ payments: [{ amount: 55000 }] })]) as never, today),
    ).rejects.toThrow('This debt is already settled.')
    await expect(repayDebt({ ...repay, amount: 10 }, depsOf([]) as never, today)).rejects.toThrow(
      'This debt no longer exists.',
    )
  })
})
