import { describe, expect, it, vi } from 'vitest'

import { confirmIncome, depositSetupMonth, listPendingIncomes } from './confirmIncome'

const today = new Date(2026, 8, 15, 10)

const setUpOn = new Date(2026, 6, 1)
const salary = { id: 'salary', source: 'Salary', amount: 300000, frequency: 'monthly', payDay: 10, createdAt: setUpOn }
const sideJob = { id: 'side', source: 'Side job', amount: 7000, frequency: 'weekly', payDay: 5, createdAt: setUpOn }
const notYet = { id: 'later', source: 'Rent received', amount: 50000, frequency: 'monthly', payDay: 25, createdAt: setUpOn }
const justSetUp = { id: 'new', source: 'Bonus', amount: 9000, frequency: 'monthly', payDay: 1, createdAt: new Date(2026, 8, 1) }

const allocations = [
  { amount: 100000, period: 'monthly', category: 'fixed' },
  { amount: 60000, period: 'monthly', category: 'daily_living' },
  { amount: 20000, period: 'monthly', category: 'savings' },
]

const depsOf = (receipts: { incomeId: string }[] = []) => ({
  listIncomes: vi.fn().mockResolvedValue([salary, sideJob, notYet, justSetUp]),
  listAllocations: vi.fn().mockResolvedValue(allocations),
  listReceipts: vi.fn().mockResolvedValue(receipts),
  confirm: vi.fn().mockResolvedValue(true),
})

describe('listPendingIncomes', () => {
  it('lists the incomes due and not confirmed this month, with the usual amount', async () => {
    const deps = depsOf()

    await expect(listPendingIncomes('user-1', today, deps)).resolves.toEqual([
      { id: 'salary', source: 'Salary', usualAmount: 300000 },
      // Weekly 7,000 over September's 30 days.
      { id: 'side', source: 'Side job', usualAmount: 30000 },
    ])
    expect(deps.listReceipts).toHaveBeenCalledWith('user-1', new Date(2026, 8, 1))
  })

  it('leaves out an income already confirmed', async () => {
    const pending = await listPendingIncomes('user-1', today, depsOf([{ incomeId: 'side' }]))

    expect(pending.map((income) => income.id)).toEqual(['salary'])
  })
})

describe('depositSetupMonth', () => {
  it('counts the income set up this month as received, and nothing older or already done', async () => {
    const deps = depsOf()

    // Only "Bonus" was set up in September.
    await expect(depositSetupMonth('user-1', today, deps)).resolves.toBe(1)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
    expect(deps.confirm).toHaveBeenCalledWith('user-1', expect.objectContaining({ incomeId: 'new', amount: 9000 }))

    const done = depsOf([{ incomeId: 'new' }])
    await expect(depositSetupMonth('user-1', today, done)).resolves.toBe(0)
    expect(done.confirm).not.toHaveBeenCalled()
  })
})

describe('confirmIncome', () => {
  it('records the arrival for the month, with deposits based on what really came in', async () => {
    const deps = depsOf()

    await confirmIncome({ userId: 'user-1', incomeId: 'salary', amount: 250000 }, today, deps)

    expect(deps.confirm).toHaveBeenCalledWith('user-1', {
      incomeId: 'salary',
      amount: 250000,
      periodStart: new Date(2026, 8, 1),
      periodEnd: new Date(2026, 8, 30, 23, 59, 59, 999),
      receivedAt: today,
      depositsFor: expect.any(Function),
    })

    const { depositsFor } = deps.confirm.mock.calls[0][1]
    expect(depositsFor(0)).toEqual({ savings: 20000, unallocated: 70000 })
    // Another income already covered the plan: all of this one is unallocated.
    expect(depositsFor(180000)).toEqual({ savings: 0, unallocated: 250000 })
  })

  it('refuses an income that is not the user’s, or one already confirmed', async () => {
    const deps = depsOf()

    await expect(confirmIncome({ userId: 'user-1', incomeId: 'other', amount: 10 }, today, deps)).rejects.toThrow(
      'This income no longer exists.',
    )
    expect(deps.confirm).not.toHaveBeenCalled()

    deps.confirm.mockResolvedValue(false)
    await expect(confirmIncome({ userId: 'user-1', incomeId: 'salary', amount: 10 }, today, deps)).rejects.toThrow(
      'This income is already confirmed for this month.',
    )
  })
})
