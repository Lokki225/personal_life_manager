import { describe, expect, it, vi } from 'vitest'

import { removeAllocation, removeIncome, saveAllocation, saveIncome } from './managePlan'

const today = new Date(2026, 9, 2, 12)
const rent = { name: ' Rent ', amount: 100000, period: 'monthly', category: 'fixed' }

const depsOf = () => ({
  listAllocations: vi.fn().mockResolvedValue([{ id: 'alloc-1' }]),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
})

describe('saveAllocation', () => {
  it('adds a new allocation starting today', async () => {
    const deps = depsOf()

    await saveAllocation('user-1', rent, deps, today)

    expect(deps.create).toHaveBeenCalledWith('user-1', {
      name: 'Rent',
      amount: 100000,
      period: 'monthly',
      category: 'fixed',
      startDate: today,
    })
    expect(deps.update).not.toHaveBeenCalled()
  })

  it('changes one of the user’s allocations', async () => {
    const deps = depsOf()

    await saveAllocation('user-1', { ...rent, id: 'alloc-1', amount: 120000 }, deps, today)

    expect(deps.update).toHaveBeenCalledWith('user-1', 'alloc-1', {
      name: 'Rent',
      amount: 120000,
      period: 'monthly',
      category: 'fixed',
    })
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('refuses an allocation that is not the user’s', async () => {
    const deps = depsOf()

    await expect(saveAllocation('user-1', { ...rent, id: 'someone-else' }, deps, today)).rejects.toThrow(
      'This allocation no longer exists.',
    )
    expect(deps.update).not.toHaveBeenCalled()
  })
})

describe('removeAllocation', () => {
  it('removes one of the user’s allocations, and only theirs', async () => {
    const deps = depsOf()

    await removeAllocation('user-1', 'alloc-1', deps)
    expect(deps.remove).toHaveBeenCalledWith('user-1', 'alloc-1')

    await expect(removeAllocation('user-1', 'someone-else', deps)).rejects.toThrow('This allocation no longer exists.')
    expect(deps.remove).toHaveBeenCalledTimes(1)
  })
})

describe('incomes', () => {
  const salary = { source: ' Salary ', amount: 350000, payDay: 27 }
  const depsOf = (ids: string[] = ['income-1', 'income-2']) => ({
    listIncomes: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  })

  it('adds a monthly income', async () => {
    const deps = depsOf()

    await saveIncome('user-1', salary, deps)

    expect(deps.create).toHaveBeenCalledWith('user-1', { source: 'Salary', amount: 350000, frequency: 'monthly', payDay: 27 })
    expect(deps.update).not.toHaveBeenCalled()
  })

  it('corrects one of the user’s incomes, and only theirs', async () => {
    const deps = depsOf()

    await saveIncome('user-1', { ...salary, id: 'income-1' }, deps)
    expect(deps.update).toHaveBeenCalledWith('user-1', 'income-1', { source: 'Salary', amount: 350000, payDay: 27 })

    await expect(saveIncome('user-1', { ...salary, id: 'someone-else' }, deps)).rejects.toThrow(
      'This income no longer exists.',
    )
    expect(deps.update).toHaveBeenCalledTimes(1)
  })

  it('removes an income, but never the last one or someone else’s', async () => {
    const deps = depsOf()

    await removeIncome('user-1', 'income-2', deps)
    expect(deps.remove).toHaveBeenCalledWith('user-1', 'income-2')

    await expect(removeIncome('user-1', 'someone-else', deps)).rejects.toThrow('This income no longer exists.')
    await expect(removeIncome('user-1', 'income-1', depsOf(['income-1']))).rejects.toThrow(
      'Your plan needs at least one income.',
    )
    expect(deps.remove).toHaveBeenCalledTimes(1)
  })
})

describe('saveIncome without a pay day', () => {
  it('records money that came once, out of the plan', async () => {
    const deps = { listIncomes: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
    const oneOff = vi.fn(async () => {})

    await saveIncome('user-1', { source: 'Gift from my uncle', amount: 50000, payDay: null }, deps, oneOff)

    expect(oneOff).toHaveBeenCalledWith('user-1', { source: 'Gift from my uncle', amount: 50000 })
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('keeps the pay day of an income already in the plan', async () => {
    const deps = { listIncomes: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
    await expect(saveIncome('user-1', { id: 'i1', source: 'Salary', amount: 1, payDay: null }, deps, vi.fn())).rejects.toMatchObject({
      field: 'payDay',
    })
  })
})
