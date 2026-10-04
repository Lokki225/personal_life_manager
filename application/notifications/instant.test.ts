import { describe, expect, it, vi } from 'vitest'

import { createTranslator } from '../../lib/i18n/translate'
import { instantMessage, notifyAdmins, notifyPerson, notifyReachedGoals, reachedSavingsGoals } from './instant'

const phone = { endpoint: 'https://push.example/1', p256dh: 'key', auth: 'auth' }
const person = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  locale: 'en',
  notifyMoney: true,
  notifyAdmin: true,
  subscriptions: [phone],
  ...overrides,
})

const depsOf = (found: ReturnType<typeof person> | null, claimed = true) => ({
  repository: {
    person: vi.fn().mockResolvedValue(found),
    admins: vi.fn().mockResolvedValue(found ? [found] : []),
    claim: vi.fn().mockResolvedValue(claimed),
  },
  notify: vi.fn().mockResolvedValue(1),
})

const now = new Date('2026-10-04T10:15:00Z')

describe('notifyPerson', () => {
  it('tells a goal reached once', async () => {
    const deps = depsOf(person())

    await expect(notifyPerson('user-1', { kind: 'goalReached', goalId: 'g1', name: 'Laptop' }, deps, now)).resolves.toBe(1)
    expect(deps.repository.claim).toHaveBeenCalledWith('user-1', 'goal:g1')
    expect(deps.notify).toHaveBeenCalledWith([phone], expect.objectContaining({ title: 'Goal reached: Laptop' }))

    const again = depsOf(person(), false)
    await expect(notifyPerson('user-1', { kind: 'goalReached', goalId: 'g1', name: 'Laptop' }, again, now)).resolves.toBe(0)
    expect(again.notify).not.toHaveBeenCalled()
  })

  it('tells changes by a key at most once an hour per key', async () => {
    const deps = depsOf(person())
    const event = { kind: 'changedByKey' as const, tokenId: 'k1', keyName: 'Script', action: 'Recorded an expense of {amount}.', amount: 1500 }

    await notifyPerson('user-1', event, deps, now)

    expect(deps.repository.claim).toHaveBeenCalledWith('user-1', 'key:k1:2026-10-04T10')
    expect(deps.notify).toHaveBeenCalledWith([phone], {
      title: 'The key "Script" changed your finances',
      body: 'Recorded an expense of 1,500 XOF.',
      url: '/finance/history',
    })
  })

  it('respects money reminders turned off, but always sends security notices', async () => {
    const quiet = person({ notifyMoney: false, notifyAdmin: false })

    const money = depsOf(quiet)
    await expect(notifyPerson('user-1', { kind: 'goalReached', goalId: 'g1', name: 'Laptop' }, money, now)).resolves.toBe(0)

    const security = depsOf(quiet)
    await expect(notifyPerson('user-1', { kind: 'apiKeyCreated', name: 'Script' }, security, now)).resolves.toBe(1)
    expect(security.repository.claim).not.toHaveBeenCalled()
  })

  it('does nothing for someone without a device, or who no longer exists', async () => {
    await expect(notifyPerson('user-1', { kind: 'resetLinkCreated' }, depsOf(person({ subscriptions: [] })), now)).resolves.toBe(0)
    await expect(notifyPerson('gone', { kind: 'resetLinkCreated' }, depsOf(null), now)).resolves.toBe(0)
  })
})

describe('notifyAdmins', () => {
  it('tells administrators who want administration alerts', async () => {
    const deps = depsOf(person())

    await expect(notifyAdmins({ kind: 'newAccount', name: 'Awa Koné', email: 'awa@example.com' }, deps, now)).resolves.toBe(1)

    const off = depsOf(person({ notifyAdmin: false }))
    await expect(notifyAdmins({ kind: 'newAccount', name: 'Awa Koné', email: 'awa@example.com' }, off, now)).resolves.toBe(0)
  })
})

describe('instantMessage', () => {
  it('words each notice in the person’s language', () => {
    const fr = createTranslator('fr')

    expect(instantMessage({ kind: 'credentialsChanged', email: false, password: true }, fr).title).toBe(
      'Vos identifiants ont été modifiés',
    )
    expect(instantMessage({ kind: 'newFeedback', name: 'Awa', message: 'x'.repeat(300) }, fr).body).toHaveLength(140)
  })
})

describe('goals reached', () => {
  const goals = [
    { id: 'laptop', name: 'Laptop', satisfied: true, conditionResults: [{ measurement: 'chest_balance' }] },
    { id: 'trip', name: 'Trip', satisfied: false, conditionResults: [{ measurement: 'chest_balance' }] },
    // Comes and goes with the month: not announced.
    { id: 'calm', name: 'Calm month', satisfied: true, conditionResults: [{ measurement: 'monthly_deviation_count' }] },
  ]

  it('are the savings goals whose chest reached its target', () => {
    expect(reachedSavingsGoals(goals)).toEqual([{ id: 'laptop', name: 'Laptop' }])
  })

  it('are each announced after money moved', async () => {
    const notify = vi.fn().mockResolvedValue(1)

    await notifyReachedGoals('user-1', { goals: async () => goals, notifyPerson: notify })

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('user-1', { kind: 'goalReached', goalId: 'laptop', name: 'Laptop' })
  })
})
