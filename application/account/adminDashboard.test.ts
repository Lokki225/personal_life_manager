import { describe, expect, it, vi } from 'vitest'

import { getAdminDashboard, recordVisit } from './adminDashboard'

const now = new Date(2026, 9, 15, 12)
const daysAgo = (days: number) => new Date(2026, 9, 15 - days, 10)

const user = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.com`,
  username: id,
  role: 'USER' as const,
  createdAt: daysAgo(60),
  lastSeenAt: null,
  locale: null,
  hasPlan: true,
  ...overrides,
})

const usage = (overrides: Record<string, unknown>) => ({
  expenses: 0,
  savings: 0,
  explanations: 0,
  goals: 0,
  debts: 0,
  ownChests: 0,
  incomeConfirmations: 0,
  lastEntryAt: null,
  ...overrides,
})

const repository = {
  listUsers: vi.fn().mockResolvedValue([
    user('awa', { locale: 'fr', lastSeenAt: daysAgo(0) }),
    user('ben', { locale: 'en', lastSeenAt: daysAgo(20) }),
    user('cy', { hasPlan: false }),
  ]),
  usageByUser: vi.fn().mockResolvedValue(
    new Map([
      ['awa', usage({ expenses: 40, savings: 6, goals: 1, lastEntryAt: daysAgo(1) })],
      ['ben', usage({ expenses: 3, debts: 1, lastEntryAt: daysAgo(50) })],
    ]),
  ),
  entriesSince: vi.fn().mockResolvedValue([
    { userId: 'awa', at: daysAgo(1) },
    { userId: 'awa', at: daysAgo(1) },
    { userId: 'awa', at: daysAgo(4) },
  ]),
}

describe('getAdminDashboard', () => {
  it('is for administrators only', async () => {
    await expect(getAdminDashboard({ role: 'USER' }, now, repository)).rejects.toThrow(
      'Only an administrator can do this.',
    )
  })

  it('shows who is active, how far people get and which features are used', async () => {
    const dashboard = await getAdminDashboard({ role: 'ADMIN' }, now, repository)

    expect(repository.entriesSince).toHaveBeenCalledWith(new Date(2026, 8, 16))
    expect(dashboard.users.map((row) => [row.id, row.status, row.activeDays])).toEqual([
      ['awa', 'active', 2],
      // Seen 20 days ago, which is later than the last thing recorded.
      ['ben', 'quiet', 0],
      ['cy', 'never', 0],
    ])
    expect(dashboard.activeThisWeek).toBe(1)
    expect(dashboard.funnel).toEqual({ signedUp: 3, planSetUp: 2, firstExpense: 2, afterAWeek: 2, afterAMonth: 1 })
    expect(Object.fromEntries(dashboard.features.map((feature) => [feature.key, feature.users]))).toEqual({
      expenses: 2,
      savings: 1,
      ownChests: 0,
      goals: 1,
      debts: 1,
      explanations: 0,
      incomeConfirmations: 0,
    })
    expect(dashboard.activePerDay).toHaveLength(30)
    expect(dashboard.activePerDay.at(-2)?.users).toBe(1)
    expect(dashboard.languages).toEqual({ fr: 1, en: 1 })
  })
})

describe('recordVisit', () => {
  it('writes once a day, and again when the language changes', async () => {
    const store = { recordVisit: vi.fn() }
    const seenToday = { id: 'awa', lastSeenAt: new Date(2026, 9, 15, 8), locale: 'fr' }

    await recordVisit(seenToday, 'fr', now, store)
    expect(store.recordVisit).not.toHaveBeenCalled()

    await recordVisit(seenToday, 'en', now, store)
    await recordVisit({ ...seenToday, lastSeenAt: daysAgo(1) }, 'fr', now, store)
    await recordVisit({ ...seenToday, lastSeenAt: null }, 'fr', now, store)

    expect(store.recordVisit.mock.calls).toEqual([
      ['awa', now, 'en'],
      ['awa', now, 'fr'],
      ['awa', now, 'fr'],
    ])
  })
})
