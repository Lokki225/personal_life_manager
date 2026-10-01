import { describe, expect, it, vi } from 'vitest'

import { FinanceRuleError } from '../../domain/finance/errors'
import { createSetupPlan, hasSetupPlan } from './createSetupPlan'

const plan = {
  incomeSource: 'Salary',
  incomeAmount: 300000,
  incomeFrequency: 'monthly',
  allocations: [{ name: 'Rent', amount: 100000, period: 'monthly', category: 'fixed' }],
}

describe('createSetupPlan', () => {
  it('saves the income and allocations together, starting today', async () => {
    const repository = { hasIncome: vi.fn(), createInitialPlan: vi.fn().mockResolvedValue(true) }
    const today = new Date(2026, 9, 1)

    await createSetupPlan('user-1', plan, repository, today)

    expect(repository.createInitialPlan).toHaveBeenCalledTimes(1)
    expect(repository.createInitialPlan).toHaveBeenCalledWith('user-1', {
      income: { source: 'Salary', amount: 300000, frequency: 'monthly' },
      allocations: plan.allocations,
      startDate: today,
    })
  })

  it('refuses a second setup with a message for the form', async () => {
    const repository = { hasIncome: vi.fn(), createInitialPlan: vi.fn().mockResolvedValue(false) }

    await expect(createSetupPlan('user-1', plan, repository)).rejects.toThrow(FinanceRuleError)
    await expect(createSetupPlan('user-1', plan, repository)).rejects.toThrow(
      'Your plan is already set up. Nothing was saved again.',
    )
  })
})

describe('hasSetupPlan', () => {
  it('is true once the user has an income', async () => {
    const repository = { hasIncome: vi.fn().mockResolvedValue(true), createInitialPlan: vi.fn() }

    await expect(hasSetupPlan('user-1', repository)).resolves.toBe(true)
    expect(repository.hasIncome).toHaveBeenCalledWith('user-1')
  })
})
