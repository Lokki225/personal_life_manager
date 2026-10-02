import { describe, expect, it, vi } from 'vitest'

import { removeAllocation, saveAllocation } from './managePlan'

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

    expect(deps.update).toHaveBeenCalledWith('alloc-1', {
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
    expect(deps.remove).toHaveBeenCalledWith('alloc-1')

    await expect(removeAllocation('user-1', 'someone-else', deps)).rejects.toThrow('This allocation no longer exists.')
    expect(deps.remove).toHaveBeenCalledTimes(1)
  })
})
