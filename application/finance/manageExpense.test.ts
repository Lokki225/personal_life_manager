import { describe, expect, it, vi } from 'vitest'

import { editExpense, removeExpense } from './manageExpense'

const today = new Date(2026, 9, 3, 18)
const at = (hour: number) => new Date(2026, 9, 3, hour)

// A 2,000 budget: lunch fits, the taxi goes over by 300.
const lunch = { id: 'lunch', amount: 1500, date: at(12), createdAt: at(12) }
const taxi = { id: 'taxi', amount: 800, date: at(15), createdAt: at(15) }
const yesterday = { id: 'old', amount: 400, date: new Date(2026, 9, 2, 12), createdAt: new Date(2026, 9, 2, 12) }
const taxiException = { id: 'x-taxi', expenseId: 'taxi' }
const laptop = {
  id: 'laptop-bought',
  amount: 300000,
  date: at(16),
  createdAt: at(16),
  paidFromChestId: 'laptop',
  paidFromChestName: 'Laptop',
}
const laptopChest = { id: 'laptop', name: 'Laptop', type: 'AVAILABLE', lockedUntil: null, balance: 20000 }

const depsOf = (
  after: unknown[],
  overrides: { exceptions?: unknown[]; state?: Record<string, unknown> } = {},
) => {
  const listExpenses = vi.fn()
  // Read once to check the expense, then again after the change.
  listExpenses.mockResolvedValueOnce([lunch, taxi, yesterday, laptop]).mockResolvedValue(after)

  return {
    getToday: vi.fn().mockResolvedValue({ dailyBudget: 2000, savedToday: 0, coveredToday: 0, uncoveredDay: false, ...overrides.state }),
    listExpenses,
    listExceptions: vi.fn().mockResolvedValue(overrides.exceptions ?? [taxiException]),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    createException: vi.fn(),
    updateException: vi.fn(),
    deleteException: vi.fn(),
    listChests: vi.fn().mockResolvedValue([laptopChest]),
    updateChestExpense: vi.fn(),
  }
}

describe('editExpense', () => {
  it('saves the change and updates the exception of the expense that goes over', async () => {
    // Lunch becomes 1,800: the taxi now goes over by 600.
    const deps = depsOf([{ ...lunch, amount: 1800 }, taxi, yesterday])

    await editExpense('user-1', { id: 'lunch', amount: 1800, category: 'food', description: ' Lunch ' }, deps, today)

    expect(deps.updateExpense).toHaveBeenCalledWith('user-1', 'lunch', { amount: 1800, category: 'food', description: 'Lunch' })
    expect(deps.updateException).toHaveBeenCalledWith('user-1', 'x-taxi', { plannedAmount: 200, actualAmount: 800, difference: 600 })
    expect(deps.createException).not.toHaveBeenCalled()
    expect(deps.deleteException).not.toHaveBeenCalled()
  })

  it('removes an exception that no longer applies, and creates one that now does', async () => {
    // Lunch drops to 500: the taxi fits again.
    const fits = depsOf([{ ...lunch, amount: 500 }, taxi])
    await editExpense('user-1', { id: 'lunch', amount: 500, category: 'food' }, fits, today)
    expect(fits.deleteException).toHaveBeenCalledWith('user-1', 'x-taxi')

    // Lunch jumps to 2,500 with no exception of its own yet.
    const over = depsOf([{ ...lunch, amount: 2500 }, taxi])
    await editExpense('user-1', { id: 'lunch', amount: 2500, category: 'food' }, over, today)
    expect(over.createException).toHaveBeenCalledWith(
      expect.objectContaining({ expenseId: 'lunch', difference: 500, category: 'unexplained', date: today }),
    )
    expect(over.updateException).toHaveBeenCalledWith('user-1', 'x-taxi', { plannedAmount: 0, actualAmount: 800, difference: 800 })
  })

  it('refuses an expense of another day, of a 31st, or that is not the user’s', async () => {
    const edit = (id: string, deps: ReturnType<typeof depsOf>) =>
      editExpense('user-1', { id, amount: 100, category: 'food' }, deps, today)

    await expect(edit('old', depsOf([]))).rejects.toThrow('An expense can only be changed the day it was made.')
    await expect(edit('someone-else', depsOf([]))).rejects.toThrow('This expense no longer exists.')

    const day31 = depsOf([], { state: { uncoveredDay: true } })
    await expect(edit('lunch', day31)).rejects.toThrow('Expenses of a 31st cannot be changed.')
    expect(day31.updateExpense).not.toHaveBeenCalled()
  })
})

describe('removeExpense', () => {
  it('deletes the expense with its exception', async () => {
    const deps = depsOf([lunch, yesterday])

    await removeExpense('user-1', 'taxi', deps, today)

    expect(deps.deleteException).toHaveBeenCalledWith('user-1', 'x-taxi')
    expect(deps.deleteExpense).toHaveBeenCalledWith('user-1', 'taxi')
  })

  it('clears the exception of a later expense that fits once an earlier one is gone', async () => {
    const deps = depsOf([taxi, yesterday])

    await removeExpense('user-1', 'lunch', deps, today)

    expect(deps.deleteExpense).toHaveBeenCalledWith('user-1', 'lunch')
    expect(deps.deleteException).toHaveBeenCalledWith('user-1', 'x-taxi')
  })
})

describe('an expense paid from a chest', () => {
  it('changes with its chest money, and never touches the exceptions', async () => {
    const deps = depsOf([lunch, taxi, laptop])

    await editExpense('user-1', { id: 'laptop-bought', amount: 310000, category: 'shopping', description: 'Laptop' }, deps, today)

    expect(deps.updateChestExpense).toHaveBeenCalledWith('user-1', 'laptop-bought', {
      amount: 310000,
      category: 'shopping',
      description: 'Laptop',
    })
    expect(deps.updateExpense).not.toHaveBeenCalled()
    expect(deps.updateException).not.toHaveBeenCalled()
    expect(deps.createException).not.toHaveBeenCalled()
  })

  it('cannot take more than its chest still holds', async () => {
    await expect(
      editExpense('user-1', { id: 'laptop-bought', amount: 330000, category: 'shopping' }, depsOf([]), today),
    ).rejects.toThrow('Laptop only holds 20,000.')
  })

  it('can be changed on a 31st, since its chest gets the money back exactly', async () => {
    const deps = depsOf([], { state: { uncoveredDay: true } })

    await editExpense('user-1', { id: 'laptop-bought', amount: 1000, category: 'shopping' }, deps, today)

    expect(deps.updateChestExpense).toHaveBeenCalled()
  })

  it('does not count among the expenses that can go over the day', async () => {
    // The laptop is recorded before the taxi: were it counted, the taxi would go further over.
    const deps = depsOf([lunch, laptop, taxi])

    await editExpense('user-1', { id: 'lunch', amount: 1500, category: 'food' }, deps, today)

    expect(deps.updateException).toHaveBeenCalledWith('user-1', 'x-taxi', { plannedAmount: 500, actualAmount: 800, difference: 300 })
  })
})
