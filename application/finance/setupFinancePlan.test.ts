import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getServerSession } from 'next-auth'

import { resolveSessionUserId } from '../../app/finance/setup/actions'
import { summarizeSetupPlan } from './setupFinancePlan'

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))

describe('summarizeSetupPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the authenticated session user id when present', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'session-user-123',
        email: 'franklinlokki@gmail.com',
        name: 'Franklin',
      },
    } as never)

    await expect(resolveSessionUserId()).resolves.toBe('session-user-123')
  })

  it('derives the correct daily budget for monthly allocations', () => {
    const summary = summarizeSetupPlan({
      incomeAmount: 5000,
      allocationAmount: 3000,
      allocationPeriod: 'monthly',
      referenceDate: new Date(2026, 1, 1),
    })

    expect(summary.dailyBudget).toBe(3000 / 28)
    expect(summary.incomeAmount).toBe(5000)
  })

  it('derives the correct daily budget for weekly allocations', () => {
    const summary = summarizeSetupPlan({
      incomeAmount: 5000,
      allocationAmount: 7000,
      allocationPeriod: 'weekly',
      referenceDate: new Date(2026, 5, 1),
    })

    expect(summary.dailyBudget).toBe(1000)
  })
})
