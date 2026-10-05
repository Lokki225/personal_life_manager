import { describe, expect, it } from 'vitest'

import { evaluateCondition, evaluateGroup, summarize, type ConditionGroup, type GoalCondition, type Resolve, type SourceAnswer } from './engine'
import { judgementAnswer, type Judgement } from './judgementSource'
import { deriveStatus, shouldStampAchieved, type StatusInput } from './status'

// The engine's results beyond met / not met (mechanism v0.2): exceeds,
// unknown, review due, choices, levels, subjects and confirmation.

const now = new Date(2026, 9, 7, 12)
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

const condition = (extra: Partial<GoalCondition> = {}): GoalCondition => ({
  id: 'c',
  source: 'TEST',
  sourceRef: {},
  aggregation: 'LATEST',
  window: { type: 'ALL_TIME' },
  operator: 'GTE',
  target: 600000,
  ...extra,
})

const answering = (answer: SourceAnswer): Resolve => () => answer
const value = (n: number, at = now): SourceAnswer => ({ points: [{ at, value: n }], emptyMeans: 'unknown' })

describe('condition results', () => {
  it('tells met, exceeds and gap apart', () => {
    expect(evaluateCondition(condition(), answering(value(600000)), now, now).result).toBe('MET')
    expect(evaluateCondition(condition(), answering(value(700000)), now, now).result).toBe('EXCEEDS')
    expect(evaluateCondition(condition({ operator: 'LTE', target: 40 }), answering(value(35)), now, now).result).toBe('EXCEEDS')
    const gap = evaluateCondition(condition(), answering(value(450000)), now, now)
    expect(gap).toMatchObject({ result: 'GAP', satisfied: false, value: 450000 })
  })

  it('says unknown when the source has nothing and nothing means unknown', () => {
    const result = evaluateCondition(condition(), answering({ points: [], emptyMeans: 'unknown' }), now, now)
    expect(result).toMatchObject({ result: 'UNKNOWN', value: null, satisfied: false, reviewDue: false })
  })

  it('keeps the old meaning for sources that answer with points: nothing is zero', () => {
    const result = evaluateCondition(condition({ aggregation: 'COUNT', operator: 'LTE', target: 2 }), () => [], now, now)
    expect(result).toMatchObject({ result: 'EXCEEDS', actual: 0, satisfied: true })
  })

  it('compares a choice with the accepted values, ignoring case', () => {
    const choice = condition({ operator: 'IN', target: 0, acceptedValues: ['remote', 'hybrid'] })
    expect(evaluateCondition(choice, answering({ points: [], emptyMeans: 'unknown', text: 'Remote' }), now, now)).toMatchObject({ result: 'MET', value: 'Remote' })
    expect(evaluateCondition(choice, answering({ points: [], emptyMeans: 'unknown', text: 'on-site' }), now, now).result).toBe('GAP')
    expect(evaluateCondition(choice, answering({ points: [], emptyMeans: 'unknown', text: null }), now, now).result).toBe('UNKNOWN')
  })

  it('flags a result as due for review when what it rests on is old, keeping the result', () => {
    const old: SourceAnswer = { ...value(700000), asOf: daysAgo(200), staleAfterDays: 180 }
    expect(evaluateCondition(condition(), answering(old), now, now)).toMatchObject({ result: 'EXCEEDS', reviewDue: true })
    expect(evaluateCondition(condition({ staleAfterDays: 365 }), answering(old), now, now).reviewDue).toBe(false)
    expect(evaluateCondition(condition(), answering({ ...old, asOf: daysAgo(10) }), now, now).reviewDue).toBe(false)
  })

  it('is evaluated against the subject it is given', () => {
    const resolve: Resolve = (_c, subject) => value(subject.type === 'SELF' ? 450000 : 650000)
    expect(evaluateCondition(condition(), resolve, now, now).result).toBe('GAP')
    expect(evaluateCondition(condition(), resolve, now, now, { type: 'OPPORTUNITY', id: 'o1' }).result).toBe('EXCEEDS')
  })
})

describe('groups with levels and unknowns', () => {
  const byId: Record<string, SourceAnswer> = {
    pay: value(650000),
    remote: { points: [], emptyMeans: 'unknown', text: 'remote' },
    unknown: { points: [], emptyMeans: 'unknown' },
    low: value(1),
  }
  const resolve: Resolve = (c) => byId[c.id]
  const c = (id: string, extra: Partial<GoalCondition> = {}) => condition({ id, ...extra })
  const choice = { operator: 'IN' as const, target: 0, acceptedValues: ['remote', 'hybrid'] }
  const group = (logic: 'ALL' | 'ANY', conditions: GoalCondition[]): ConditionGroup => ({ id: 'g', logic, role: 'COMPLETION', conditions, children: [] })

  it('holds only on known results: an unknown required condition blocks ALL', () => {
    expect(evaluateGroup(group('ALL', [c('pay'), c('remote', choice)]), resolve, now, now).satisfied).toBe(true)
    expect(evaluateGroup(group('ALL', [c('pay'), c('unknown')]), resolve, now, now).satisfied).toBe(false)
    expect(evaluateGroup(group('ANY', [c('unknown'), c('pay')]), resolve, now, now).satisfied).toBe(true)
  })

  it('never lets a preferred or info condition block achievement', () => {
    const conditions = [c('pay'), c('low', { level: 'PREFERRED' }), c('unknown', { level: 'INFO' })]
    const result = evaluateGroup(group('ALL', conditions), resolve, now, now)
    expect(result.satisfied).toBe(true)
    expect(result.results).toHaveLength(3)
  })

  it('decides nothing with only preferred conditions', () => {
    expect(evaluateGroup(group('ALL', [c('pay', { level: 'PREFERRED' })]), resolve, now, now).satisfied).toBe(false)
  })

  it('counts results per level, never as a percentage', () => {
    const conditions = [
      c('pay'),
      c('unknown'),
      c('low'),
      c('remote', { ...choice, level: 'PREFERRED' }),
      c('unknown', { level: 'PREFERRED' }),
      c('pay', { level: 'INFO' }),
    ]
    expect(summarize(evaluateGroup(group('ALL', conditions), resolve, now, now).results)).toEqual({
      required: { met: 0, exceeds: 1, gap: 1, unknown: 1, reviewDue: 0 },
      preferred: { met: 1, exceeds: 0, gap: 0, unknown: 1, reviewDue: 0 },
      info: 1,
    })
  })
})

describe('judgements', () => {
  const judgement = (extra: Partial<Judgement>): Judgement => ({
    conditionId: 'c',
    subjectType: 'SELF',
    subjectId: null,
    result: 'MET',
    judgedAt: daysAgo(5),
    ...extra,
  })
  const judged = (judgements: Judgement[], subject = { type: 'SELF' as const }) =>
    evaluateCondition(condition({ source: 'JUDGEMENT', operator: 'EQ', target: 1 }), () => judgementAnswer(judgements, 'c', subject), now, now, subject)

  it('uses the latest judgement for the subject', () => {
    expect(judged([judgement({ result: 'GAP', judgedAt: daysAgo(30) }), judgement({})]).result).toBe('MET')
    expect(judged([judgement({ result: 'MET', judgedAt: daysAgo(30) }), judgement({ result: 'GAP' })]).result).toBe('GAP')
  })

  it('is unknown before any judgement, or when judged unknown', () => {
    expect(judged([]).result).toBe('UNKNOWN')
    expect(judged([judgement({ result: 'UNKNOWN' })]).result).toBe('UNKNOWN')
  })

  it('keeps each subject’s judgements apart', () => {
    const offer = { type: 'OPPORTUNITY' as const, id: 'o1' }
    const judgements = [judgement({ result: 'GAP' }), judgement({ subjectType: 'OPPORTUNITY', subjectId: 'o1', result: 'MET' })]
    expect(judged(judgements).result).toBe('GAP')
    expect(evaluateCondition(condition({ source: 'JUDGEMENT', operator: 'EQ', target: 1 }), () => judgementAnswer(judgements, 'c', offer), now, now, offer).result).toBe('MET')
  })

  it('is due for review after 90 days, still showing its result', () => {
    expect(judged([judgement({ judgedAt: daysAgo(120) })])).toMatchObject({ result: 'MET', reviewDue: true })
  })
})

describe('goal status with confirmation, pause and replacement', () => {
  const base: StatusInput = {
    lifecycle: 'TERMINAL',
    latch: true,
    achievedAt: null,
    abandonedAt: null,
    deadline: null,
    satisfied: false,
    hasEvidence: true,
    projected: null,
    healthy: null,
  }

  it('waits for confirmation when the goal asks for it', () => {
    const met = { ...base, satisfied: true, achievementMode: 'CONFIRM' as const }
    expect(deriveStatus(met, now)).toBe('CRITERIA_MET')
    expect(shouldStampAchieved(met)).toBe(false)
    expect(deriveStatus({ ...met, achievedAt: daysAgo(1) }, now)).toBe('ACHIEVED')
    // Confirmed stays achieved, even when the conditions stop holding.
    expect(deriveStatus({ ...met, satisfied: false, achievedAt: daysAgo(1), latch: false }, now)).toBe('ACHIEVED')
  })

  it('keeps automatic goals as they were', () => {
    expect(deriveStatus({ ...base, satisfied: true }, now)).toBe('ACHIEVED')
    expect(shouldStampAchieved({ ...base, satisfied: true })).toBe(true)
    expect(deriveStatus(base, now)).toBe('IN_PROGRESS')
  })

  it('shows paused and replaced goals as such, never as failed', () => {
    expect(deriveStatus({ ...base, pausedAt: daysAgo(3), deadline: daysAgo(1) }, now)).toBe('PAUSED')
    expect(deriveStatus({ ...base, supersededAt: daysAgo(3) }, now)).toBe('SUPERSEDED')
    expect(deriveStatus({ ...base, satisfied: true, pausedAt: daysAgo(3) }, now)).toBe('ACHIEVED')
  })
})
