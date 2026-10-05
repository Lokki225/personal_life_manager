import { describe, expect, it } from 'vitest'

import {
  activityTrend,
  countsFor,
  checkLinks,
  checkProject,
  checkStatusMove,
  hoursPerWeek,
  latest,
  moneySummary,
  momentum,
  projectSessions,
  uniqueSlug,
} from './projects'

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)
const now = day(2026, 10, 7)

describe('project fields', () => {
  it('are checked, with safe links only', () => {
    expect(checkProject({ name: ' OdO ', summary: ' ', kind: 'SOFTWARE', primaryDomain: 'career', lifeAreaId: null, startedAt: null })).toMatchObject({
      name: 'OdO',
      summary: null,
    })
    expect(() => checkProject({ name: '', summary: null, kind: 'SOFTWARE', primaryDomain: 'personal', lifeAreaId: null, startedAt: null })).toThrow(
      expect.objectContaining({ field: 'name' }),
    )
    expect(checkLinks([{ label: 'Repository', url: 'https://github.com/me/odo' }, { label: '', url: '' }])).toEqual([
      { label: 'Repository', url: 'https://github.com/me/odo' },
    ])
    expect(() => checkLinks([{ label: 'x', url: 'javascript:alert(1)' }])).toThrow(expect.objectContaining({ field: 'links' }))
    expect(() => checkLinks([{ label: '', url: 'https://a.b' }])).toThrow(expect.objectContaining({ field: 'links' }))
  })

  it('get a free URL name', () => {
    expect(uniqueSlug('OdO Core!', new Set())).toBe('odo-core')
    expect(uniqueSlug('Été à Abidjan', new Set())).toBe('ete-a-abidjan')
    expect(uniqueSlug('OdO', new Set(['odo', 'odo-2']))).toBe('odo-3')
    expect(uniqueSlug('???', new Set())).toBe('project')
  })
})

describe('status moves', () => {
  it('go anywhere; archiving says why', () => {
    expect(checkStatusMove('SHIPPED', null)).toEqual({ to: 'SHIPPED', reason: null })
    expect(() => checkStatusMove('ARCHIVED', ' ')).toThrow(expect.objectContaining({ field: 'reason' }))
    expect(checkStatusMove('ARCHIVED', 'Became part of OdO')).toEqual({ to: 'ARCHIVED', reason: 'Became part of OdO' })
  })
})

describe('momentum (scenario 5)', () => {
  it('describes, never judges', () => {
    expect(momentum('ACTIVE', day(2026, 10, 3), now)).toEqual({ kind: 'active' })
    expect(momentum('ACTIVE', day(2026, 9, 25), now)).toEqual({ kind: 'recent', days: 12 })
    expect(momentum('ACTIVE', day(2026, 9, 12), now)).toEqual({ kind: 'quiet', days: 25 })
    expect(momentum('PAUSED', day(2026, 1, 1), now)).toEqual({ kind: 'paused' })
    expect(momentum('ACTIVE', null, now)).toEqual({ kind: 'none' })
    expect(latest([null, day(2026, 9, 1), day(2026, 10, 1), undefined])).toEqual(day(2026, 10, 1))
  })

  it('compares the last 14 days with the 14 before', () => {
    expect(activityTrend([day(2026, 10, 6), day(2026, 10, 1), day(2026, 9, 20), day(2026, 8, 1)], now)).toEqual({ recent: 2, previous: 1 })
  })
})

describe('time (scenario 4)', () => {
  const session = (id: string, projectId: string | null, goalId: string | null, minutes = 60, at = day(2026, 10, 6)) => ({
    id,
    projectId,
    goalId,
    startedAt: at,
    durationMin: minutes,
  })

  it('counts a session once, linked to the project, to its goal, or both', () => {
    const sessions = [session('both', 'odo', 'users'), session('goal', null, 'users'), session('direct', 'odo', null), session('other', null, 'chess')]
    expect(projectSessions(sessions, 'odo', new Set(['users'])).map((s) => s.id)).toEqual(['both', 'goal', 'direct'])
  })

  it('counts a session for its own project and for its goal’s', () => {
    expect(countsFor({ projectId: 'odo', goalProjectId: 'odo' }, 'odo')).toBe(true)
    expect(countsFor({ projectId: null, goalProjectId: 'odo' }, 'odo')).toBe(true)
    expect(countsFor({ projectId: 'album', goalProjectId: null }, 'odo')).toBe(false)
  })

  it('gives hours per week, empty weeks included', () => {
    const weeks = hoursPerWeek([session('a', 'odo', null, 90, day(2026, 9, 22)), session('b', 'odo', null, 30, day(2026, 10, 6))], now)
    expect(weeks.map((w) => w.hours)).toEqual([1.5, 0, 0.5])
    expect(weeks[0].week).toEqual(new Date(2026, 8, 21))
  })
})

describe('money', () => {
  it('sums spent, earned and net, per month', () => {
    const summary = moneySummary([
      { date: day(2026, 9, 3), amount: 60000, flow: 'spent' },
      { date: day(2026, 10, 2), amount: 15000, flow: 'spent' },
      { date: day(2026, 10, 5), amount: 50000, flow: 'earned' },
    ])
    expect(summary).toMatchObject({ spent: 75000, earned: 50000, net: -25000 })
    expect(summary.months.map((m) => [m.month.getMonth(), m.net])).toEqual([
      [9, 35000],
      [8, -60000],
    ])
  })
})
