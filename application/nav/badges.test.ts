import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTranslator } from '@/lib/i18n/translate'

const finance = vi.hoisted(() => vi.fn())
const personal = vi.hoisted(() => vi.fn())
vi.mock('../finance/recomputeFinanceState', () => ({ recomputeFinanceState: finance }))
const career = vi.hoisted(() => vi.fn())
vi.mock('../personal/tasks', () => ({ getTodayTasks: personal }))
vi.mock('../career/week', () => ({ getWeek: career }))

const { getBadges } = await import('./badges')

const t = createTranslator('en')
const now = new Date(2026, 9, 7, 9)
const all = () => true

describe('getBadges', () => {
  beforeEach(() => {
    finance.mockReset()
    personal.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('gives one short line per node that can be opened', async () => {
    finance.mockResolvedValue({ dailyBudget: 2000, dailyRemaining: 1250 })
    personal.mockResolvedValue({ entries: [{ done: true }, { done: false }, { done: false }] })
    career.mockResolvedValue({ deadlines: [], focus: [{ status: 'OPEN' }, { status: 'DONE' }] })

    expect(await getBadges('u', all, t, now)).toEqual({
      finance: '1,250 XOF left today',
      personal: '2 tasks open',
      career: '1 focus item open',
      projection: null,
    })
  })

  it('shows Career’s next deadline this week before its focus', async () => {
    finance.mockResolvedValue({ dailyBudget: 0 })
    personal.mockResolvedValue({ entries: [] })
    career.mockResolvedValue({ deadlines: [{ title: 'Offer reply', date: new Date(2026, 9, 9) }], focus: [{ status: 'OPEN' }] })

    expect((await getBadges('u', all, t, now)).career).toBe('Offer reply due Fri')
  })

  it('stays quiet for a failing node or one that cannot be opened', async () => {
    finance.mockRejectedValue(new Error('database down'))
    personal.mockResolvedValue({ entries: [] })

    expect(await getBadges('u', (id) => id === 'finance', t, now)).toEqual({ finance: null, personal: null, career: null, projection: null })
    expect(personal).not.toHaveBeenCalled()
  })

  it('has nothing to say about Finance without a plan', async () => {
    finance.mockResolvedValue({ dailyBudget: 0, dailyRemaining: 0 })
    personal.mockResolvedValue({ entries: [{ done: false }] })

    expect((await getBadges('u', all, t, now)).finance).toBeNull()
    expect((await getBadges('u', all, t, now)).personal).toBe('1 task open')
  })
})
