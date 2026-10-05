import { describe, expect, it } from 'vitest'

import type { CareerFactEvidence } from '../goals/careerSources'
import { conditionOf } from './criteria'
import { evaluateCareerGoal } from './goals'
import { changedResults, evidenceAsOf, mondayOf, parseWeek, weekOf } from './week'

const day = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h)

describe('weeks', () => {
  it('start on Monday, Sunday included in the week before', () => {
    expect(mondayOf(day(2026, 10, 7, 15))).toEqual(day(2026, 10, 5))
    expect(mondayOf(day(2026, 10, 11))).toEqual(day(2026, 10, 5))
    expect(mondayOf(day(2026, 10, 5))).toEqual(day(2026, 10, 5))
    expect(weekOf(day(2026, 10, 7))).toEqual({ start: day(2026, 10, 5), end: day(2026, 10, 12) })
  })

  it('read from the address as the Monday of that week', () => {
    expect(parseWeek('2026-10-08')).toEqual(day(2026, 10, 5))
    expect(parseWeek('soon')).toBeNull()
  })
})

describe('what changed this week', () => {
  const qualification: CareerFactEvidence = {
    id: 'q1',
    kind: 'QUALIFICATION',
    title: 'AWS SAA',
    validFrom: day(2026, 10, 7),
    validTo: null,
    source: 'DOCUMENTED',
    isPrimary: false,
    lastReviewedAt: null,
    createdAt: day(2026, 10, 7, 18),
    evidenceCount: 1,
    monthlyCompensation: null,
    workArrangement: null,
    contractType: null,
    weeklyHours: null,
    location: null,
  }
  const evidence = {
    facts: [qualification],
    opportunities: [],
    judgements: [],
    evidenceDates: new Map([['q1', [day(2026, 10, 7, 18)]]]),
  }

  it('sees the data as it stood: the qualification passed this week was not there on Monday', () => {
    expect(evidenceAsOf(evidence, day(2026, 10, 5)).facts).toEqual([])
    expect(evidenceAsOf(evidence, day(2026, 10, 9)).facts).toMatchObject([{ id: 'q1', evidenceCount: 1 }])
  })

  it('lists the criteria whose result changed: scenario 6', () => {
    const goal = {
      id: 'g',
      startDate: day(2026, 1, 1),
      deadline: null,
      achievedAt: null,
      abandonedAt: null,
      pausedAt: null,
      supersededAt: null,
      group: {
        id: 'grp',
        logic: 'ALL' as const,
        role: 'COMPLETION' as const,
        conditions: [{ id: 'c', ...conditionOf({ kind: 'evidence', level: 'REQUIRED', factKind: 'QUALIFICATION', match: 'aws saa' }) }],
        children: [],
      },
    }
    const monday = day(2026, 10, 5)
    const friday = day(2026, 10, 9, 12)
    const before = evaluateCareerGoal(goal, evidenceAsOf(evidence, monday), monday)
    const after = evaluateCareerGoal(goal, evidenceAsOf(evidence, friday), friday)

    expect(changedResults(before.results, after.results)).toMatchObject([{ condition: { id: 'c' }, from: 'GAP', to: 'MET' }])
  })
})
