import { describe, expect, it } from 'vitest'

import type { CareerEvidence, CareerFactEvidence } from '../goals/careerSources'
import type { ConditionGroup, GoalCondition } from '../goals/engine'
import { checkCriterion, conditionOf, criterionOf, type Criterion } from './criteria'
import { evaluateCareerGoal, type CareerGoalTree } from './goals'

const now = new Date(2026, 9, 7, 12)
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

const fact = (extra: Partial<CareerFactEvidence>): CareerFactEvidence => ({
  id: 'p1',
  kind: 'POSITION',
  title: 'RPA Developer',
  validFrom: new Date(2024, 0, 1),
  validTo: null,
  source: 'SELF',
  isPrimary: false,
  lastReviewedAt: daysAgo(10),
  createdAt: daysAgo(400),
  evidenceCount: 0,
  monthlyCompensation: null,
  workArrangement: null,
  contractType: null,
  weeklyHours: null,
  location: null,
  ...extra,
})

const goal = (criteria: Criterion[], extra: Partial<CareerGoalTree> = {}): CareerGoalTree => {
  const conditions: GoalCondition[] = criteria.map((c, i) => ({ id: `c${i}`, ...conditionOf(c) }))
  const group: ConditionGroup = { id: 'g', logic: 'ALL', role: 'COMPLETION', conditions, children: [] }
  return { id: 'goal', startDate: daysAgo(30), deadline: null, achievedAt: null, abandonedAt: null, pausedAt: null, supersededAt: null, group, ...extra }
}

const evidence = (extra: Partial<CareerEvidence> = {}): CareerEvidence => ({ facts: [], opportunities: [], judgements: [], ...extra })

const betterJob: Criterion[] = [
  { kind: 'number', level: 'REQUIRED', dimension: 'monthly_compensation', operator: 'GTE', target: 600000 },
  { kind: 'choice', level: 'REQUIRED', dimension: 'work_arrangement', accepted: ['remote', 'hybrid'] },
  { kind: 'judgement', level: 'PREFERRED', label: 'Interesting technical responsibilities' },
]

describe('scenario 1: a better job', () => {
  it('counts 2 required gaps and 1 preferred unknown, never a percentage', () => {
    const now450 = evidence({ facts: [fact({ monthlyCompensation: 450000, workArrangement: 'on_site' })] })
    const result = evaluateCareerGoal(goal(betterJob), now450, now)

    expect(result.summary).toEqual({
      required: { met: 0, exceeds: 0, gap: 2, unknown: 0, reviewDue: 0 },
      preferred: { met: 0, exceeds: 0, gap: 0, unknown: 1, reviewDue: 0 },
      info: 0,
    })
    expect(result.status).toBe('IN_PROGRESS')
    expect(result.results[0]).toMatchObject({ value: 450000, describe: 'position:RPA Developer' })
  })

  it('says unknown, not zero, when the position has no pay written down', () => {
    const result = evaluateCareerGoal(goal(betterJob), evidence({ facts: [fact({})] }), now)
    expect(result.summary.required).toMatchObject({ unknown: 2, gap: 0 })
  })

  it('compares an opportunity’s terms side by side with the position', () => {
    const data = evidence({
      facts: [fact({ monthlyCompensation: 450000, workArrangement: 'on_site' })],
      opportunities: [
        { id: 'o1', title: 'Offer', monthlyCompensation: 700000, workArrangement: 'hybrid', contractType: null, weeklyHours: null, location: null, updatedAt: daysAgo(1) },
      ],
    })
    const offer = evaluateCareerGoal(goal(betterJob), data, now, { type: 'OPPORTUNITY', id: 'o1' })
    expect(offer.results.map((r) => r.result)).toEqual(['EXCEEDS', 'MET', 'UNKNOWN'])
  })

  it('waits for confirmation once the required criteria hold', () => {
    const fine = evidence({ facts: [fact({ monthlyCompensation: 650000, workArrangement: 'remote' })] })
    expect(evaluateCareerGoal(goal(betterJob), fine, now).status).toBe('CRITERIA_MET')
    expect(evaluateCareerGoal(goal(betterJob, { achievedAt: daysAgo(1) }), fine, now).status).toBe('ACHIEVED')
  })
})

describe('scenario 2: project evidence', () => {
  const rust: Criterion[] = [{ kind: 'evidence', level: 'REQUIRED', factKind: 'SKILL', match: 'rust' }]

  it('turns from gap to met when the skill gets evidence, ignoring case', () => {
    const plain = evidence({ facts: [fact({ id: 's1', kind: 'SKILL', title: 'Rust' })] })
    expect(evaluateCareerGoal(goal(rust), plain, now).results[0].result).toBe('GAP')

    const documented = evidence({ facts: [fact({ id: 's1', kind: 'SKILL', title: 'Rust', source: 'DOCUMENTED', evidenceCount: 1 })] })
    expect(evaluateCareerGoal(goal(rust), documented, now).results[0]).toMatchObject({ result: 'MET', describe: 'fact:Rust' })
  })

  it('is a gap when there is no such fact, and never comes from an opportunity', () => {
    expect(evaluateCareerGoal(goal(rust), evidence(), now).results[0].result).toBe('GAP')
    expect(evaluateCareerGoal(goal(rust), evidence(), now, { type: 'OPPORTUNITY', id: 'o1' }).results[0].result).toBe('UNKNOWN')
  })

  it('ignores a skill that ended', () => {
    const ended = evidence({ facts: [fact({ kind: 'SKILL', title: 'Rust', source: 'CONFIRMED', validTo: daysAgo(5) })] })
    expect(evaluateCareerGoal(goal(rust), ended, now).results[0].result).toBe('GAP')
  })
})

describe('scenario 8: stale data', () => {
  it('shows a judgement made 4 months ago as due for review, with its result', () => {
    const judged = evidence({ judgements: [{ conditionId: 'c2', subjectType: 'SELF', subjectId: null, result: 'MET', judgedAt: daysAgo(120) }] })
    expect(evaluateCareerGoal(goal(betterJob), judged, now).results[2]).toMatchObject({ result: 'MET', reviewDue: true })
  })

  it('shows the position as due for review after 180 days without a look', () => {
    const old = evidence({ facts: [fact({ monthlyCompensation: 450000, lastReviewedAt: daysAgo(200) })] })
    expect(evaluateCareerGoal(goal(betterJob), old, now).results[0]).toMatchObject({ result: 'GAP', reviewDue: true })
  })
})

describe('criteria', () => {
  it('round-trip through the stored conditions', () => {
    for (const criterion of [...betterJob, { kind: 'evidence', level: 'INFO', factKind: 'QUALIFICATION', match: 'AWS SAA' } as Criterion]) {
      expect(criterionOf({ id: 'x', ...conditionOf(criterion) })).toEqual(criterion)
    }
  })

  it('are checked against what they can compare', () => {
    expect(() => checkCriterion({ kind: 'choice', level: 'REQUIRED', dimension: 'work_arrangement', accepted: ['moon'] }, [])).toThrow(
      expect.objectContaining({ field: 'accepted' }),
    )
    expect(checkCriterion({ kind: 'choice', level: 'REQUIRED', dimension: 'location', accepted: ['abidjan'] }, ['Abidjan'])).toMatchObject({
      accepted: ['abidjan'],
    })
    expect(() => checkCriterion({ kind: 'number', level: 'REQUIRED', dimension: 'weekly_hours', operator: 'LTE', target: 400 }, [])).toThrow()
    expect(() => checkCriterion({ kind: 'judgement', level: 'PREFERRED', label: ' ' }, [])).toThrow(expect.objectContaining({ field: 'label' }))
  })
})
