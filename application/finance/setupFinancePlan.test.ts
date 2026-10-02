import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getServerSession } from 'next-auth'

import { getSessionUserId, resolveSessionUserId } from '@/infrastructure/auth/sessionUser'
import { prisma } from '@/infrastructure/prisma/client'
import { summarizeSetupPlan } from './setupFinancePlan'

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('@/infrastructure/prisma/client', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

describe('summarizeSetupPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a session whose user is not in the database', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'gone-user', email: 'a@b.c' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    await expect(getSessionUserId()).resolves.toBeNull()
    await expect(resolveSessionUserId()).rejects.toThrow('No authenticated user found')
  })

  it('uses the authenticated session user id when present', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'session-user-123',
        email: 'franklinlokki@gmail.com',
        name: 'Franklin',
      },
    } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'session-user-123' } as never)

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
