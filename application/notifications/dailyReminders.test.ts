import { describe, expect, it, vi } from 'vitest'

import { createTranslator } from '../../lib/i18n/translate'
import { reminderMessage, sendDailyReminders } from './dailyReminders'
import { notifyDevices } from './notify'

const phone = { endpoint: 'https://push.example/phone', p256dh: 'key', auth: 'auth' }
const laptop = { endpoint: 'https://push.example/laptop', p256dh: 'key', auth: 'auth' }
const inOrder = { hasPlan: true, expensesToday: 1, pendingIncomes: [], debts: [] }

describe('notifyDevices', () => {
  it('sends to every device and forgets the ones that are gone', async () => {
    const deps = {
      send: vi.fn().mockResolvedValueOnce('sent').mockResolvedValueOnce('gone'),
      forget: vi.fn(),
    }

    await expect(notifyDevices([phone, laptop], { title: 'Hi', body: 'There', url: '/' }, deps)).resolves.toBe(1)
    expect(deps.forget).toHaveBeenCalledTimes(1)
    expect(deps.forget).toHaveBeenCalledWith(laptop.endpoint)
  })
})

describe('reminderMessage', () => {
  it('words a reminder in the person’s language', () => {
    const en = createTranslator('en')
    const fr = createTranslator('fr')
    const due = { kind: 'repaymentDue' as const, counterparty: 'Awa', amount: 5000, daysLeft: 1 }

    expect(reminderMessage(due, en)).toEqual({
      title: 'A repayment is due tomorrow',
      body: 'You owe Awa 5,000 XOF.',
      url: '/finance/debts',
    })
    expect(reminderMessage(due, fr).title).toBe('Un remboursement est dû demain')
    expect(reminderMessage({ kind: 'confirmIncome', source: 'Salary' }, fr).title).toBe('Avez-vous reçu : Salaire ?')
  })
})

describe('sendDailyReminders', () => {
  const person = (id: string, locale: string | null = 'en', notifyMoney = true) => ({
    id,
    locale,
    timeZone: 'Africa/Abidjan',
    notifyMoney,
    subscriptions: [phone],
  })

  it('sends each person what applies to them, and nothing to someone in order', async () => {
    const deps = {
      listRecipients: vi.fn().mockResolvedValue([person('awa', 'fr'), person('ben')]),
      factsFor: vi.fn(async (userId: string) => (userId === 'awa' ? { ...inOrder, expensesToday: 0 } : inOrder)),
      claim: vi.fn().mockResolvedValue(true),
      notify: vi.fn().mockResolvedValue(1),
    }

    await expect(sendDailyReminders(deps)).resolves.toEqual({ people: 2, sent: 1 })
    expect(deps.notify).toHaveBeenCalledTimes(1)
    expect(deps.notify).toHaveBeenCalledWith([phone], expect.objectContaining({ title: "Des dépenses aujourd'hui ?" }))
  })

  it('caps what one person receives, and carries on after one person fails', async () => {
    const many = { ...inOrder, pendingIncomes: ['A', 'B', 'C', 'D', 'E'].map((source) => ({ source })) }
    // The failure is logged for whoever runs the job; keep it out of the test output.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = {
      listRecipients: vi.fn().mockResolvedValue([person('broken'), person('awa')]),
      factsFor: vi.fn(async (userId: string) => {
        if (userId === 'broken') {
          throw new Error('database hiccup')
        }
        return many
      }),
      claim: vi.fn().mockResolvedValue(true),
      notify: vi.fn().mockResolvedValue(1),
    }

    await expect(sendDailyReminders(deps)).resolves.toEqual({ people: 2, sent: 3 })
    expect(deps.notify).toHaveBeenCalledTimes(3)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })

  it('sends nothing twice, and nothing to someone who turned money reminders off', async () => {
    const deps = {
      listRecipients: vi.fn().mockResolvedValue([person('awa'), person('quiet', 'en', false)]),
      factsFor: vi.fn(async () => ({ ...inOrder, expensesToday: 0 })),
      // Already sent by an earlier run.
      claim: vi.fn().mockResolvedValue(false),
      notify: vi.fn().mockResolvedValue(1),
    }

    await expect(sendDailyReminders(deps)).resolves.toEqual({ people: 2, sent: 0 })
    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.factsFor).toHaveBeenCalledTimes(1)
  })
})

describe('Career reminders in the daily run', () => {
  it('reach someone who wants Career reminders only, and never twice', async () => {
    const claimed = new Set<string>()
    const notify = vi.fn(async () => 1)
    const deps = {
      listRecipients: async () => [{ id: 'u', locale: 'en', timeZone: null, notifyMoney: false, notifyCareer: true, subscriptions: [phone] }],
      factsFor: vi.fn(),
      careerFactsFor: async () => ({
        opportunities: [{ id: 'o1', title: 'Beta offer', deadline: new Date(Date.now() + 86_400_000) }],
        openFocus: 0,
        reviewDay: 7,
        dueForReview: 0,
      }),
      claim: async (userId: string, key: string) => (claimed.has(key) ? false : (claimed.add(key), true)),
      notify,
    }

    await sendDailyReminders(deps)
    await sendDailyReminders(deps)

    expect(deps.factsFor).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith([phone], { title: 'Beta offer: the deadline is tomorrow', body: expect.any(String), url: '/career/opportunities/o1' })
  })
})
