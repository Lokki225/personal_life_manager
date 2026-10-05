import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FinanceRuleError } from '@/domain/finance/errors'

import { processSyncItems } from './sync'

const now = new Date(2026, 9, 7, 12)
const user = { id: 'u', timeZone: null, settledThrough: new Date(2026, 9, 6) }
const translate = (text: string) => `fr:${text}`

function deps() {
  const claimed = new Set<string>()
  const handler = vi.fn(async () => {})
  return {
    claimed,
    handler,
    deps: {
      claim: vi.fn(async (id: string) => {
        if (claimed.has(id)) return false
        claimed.add(id)
        return true
      }),
      release: vi.fn(async (id: string) => void claimed.delete(id)),
      handlers: {
        'finance.addExpense': handler,
        'finance.saveRemaining': handler,
        'finance.recordException': handler,
      },
    },
  }
}

const expense = (extra: object = {}) => ({
  id: 'item-1',
  action: 'finance.addExpense',
  payload: { amount: 1500, category: 'food' },
  occurredAt: new Date(2026, 9, 7, 9).toISOString(),
  ...extra,
})

describe('processSyncItems', () => {
  let d: ReturnType<typeof deps>
  beforeEach(() => {
    d = deps()
  })

  it('runs a new item once, and answers a repeat as synced without running it again', async () => {
    const first = await processSyncItems(user, [expense()], now, translate, d.deps as never)
    const again = await processSyncItems(user, [expense()], now, translate, d.deps as never)

    expect(first).toEqual([{ id: 'item-1', status: 'synced' }])
    expect(again).toEqual([{ id: 'item-1', status: 'synced' }])
    expect(d.handler).toHaveBeenCalledTimes(1)
    expect(d.handler.mock.calls[0]).toEqual([user, { amount: 1500, category: 'food' }, new Date(2026, 9, 7, 9), now])
  })

  it('refuses unknown actions, bad dates and bad payloads before anything runs', async () => {
    const results = await processSyncItems(
      user,
      [
        expense({ id: 'a', action: 'finance.transfer' }),
        expense({ id: 'b', occurredAt: new Date(2026, 9, 20).toISOString() }),
        expense({ id: 'c', occurredAt: 'yesterday' }),
        expense({ id: 'd', payload: { amount: -5, category: 'food' } }),
        expense({ id: 'e', payload: { amount: 1, category: 'rockets' } }),
      ],
      now,
      translate,
      d.deps as never,
    )

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'rejected'])
    expect(results[0]).toMatchObject({ error: 'fr:This action cannot be sent from a device.' })
    expect(results[1]).toMatchObject({ error: 'fr:This action is dated in the future.' })
    expect(d.handler).not.toHaveBeenCalled()
    expect(d.deps.claim).not.toHaveBeenCalled()
  })

  it('gives the id back when a rule refuses the action, so a fixed retry can run', async () => {
    d.handler.mockRejectedValueOnce(new FinanceRuleError('Choose one of your chests.'))

    expect(await processSyncItems(user, [expense()], now, translate, d.deps as never)).toEqual([
      { id: 'item-1', status: 'rejected', error: 'fr:Choose one of your chests.' },
    ])
    expect(d.claimed.has('item-1')).toBe(false)
  })

  it('reports a server failure as retryable, and keeps going with the next item', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    d.handler.mockRejectedValueOnce(new Error('database down'))

    const results = await processSyncItems(user, [expense({ id: 'x' }), expense({ id: 'y' })], now, translate, d.deps as never)
    expect(results).toEqual([
      { id: 'x', status: 'failed' },
      { id: 'y', status: 'synced' },
    ])
    expect(d.claimed.has('x')).toBe(false)
  })
})
