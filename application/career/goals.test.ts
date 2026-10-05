import { describe, expect, it, vi } from 'vitest'

import { conditionOf } from '../../domain/career/criteria'
import { FinanceRuleError } from '../../domain/finance/errors'
import { addCriterion, createCareerGoal, judge, listCareerGoals, markCriterionReviewed, saveForGoal, supersedeGoal } from './goals'

const now = new Date(2026, 9, 7, 12)

const storedGoal = (id: string, extra: object = {}) => ({
  id,
  name: id,
  why: null,
  importance: null,
  deadline: null,
  startDate: now,
  achievedAt: null,
  abandonedAt: null,
  abandonReason: null,
  pausedAt: null,
  supersededAt: null,
  supersededById: null,
  createdAt: now,
  group: { id: 'g', logic: 'ALL' as const, role: 'COMPLETION' as const, conditions: [], children: [] },
  ...extra,
})

const position = {
  id: 'p1',
  kind: 'POSITION' as const,
  title: 'Developer',
  validFrom: new Date(2024, 0, 1),
  validTo: null,
  source: 'SELF' as const,
  isPrimary: true,
  lastReviewedAt: null,
  createdAt: new Date(2024, 0, 1),
  evidenceCount: 0,
  monthlyCompensation: 450000,
  workArrangement: null,
  contractType: null,
  weeklyHours: null,
  location: null,
}

function repo(extra: object = {}) {
  return {
    listGoals: vi.fn(async () => [storedGoal('done', { achievedAt: now }), storedGoal('open')]),
    getGoal: vi.fn(async (_u: string, id: string) => (['open', 'done'].includes(id) ? storedGoal(id) : null)),
    createGoal: vi.fn(async () => ({ id: 'new' })),
    updateGoal: vi.fn(async () => true),
    addCondition: vi.fn(async () => ({ id: 'c' })),
    deleteCondition: vi.fn(async () => true),
    getCondition: vi.fn(async () => ({ id: 'c', goalId: 'open', ...conditionOf({ kind: 'judgement', level: 'PREFERRED', label: 'Fun' }) })),
    addJudgement: vi.fn(async () => {}),
    loadEvidence: vi.fn(async () => ({ facts: [position], opportunities: [], judgements: [] })),
    getLocations: vi.fn(async () => ['Abidjan']),
    updateFact: vi.fn(async () => true),
    createSavings: vi.fn(async () => ({ id: 'fin' })),
    savingsProgress: vi.fn(async () => null),
    ...extra,
  }
}

describe('Career goals', () => {
  it('list open goals before closed ones', async () => {
    expect((await listCareerGoals('u', now, repo() as never)).map((g) => g.id)).toEqual(['open', 'done'])
  })

  it('need a statement', async () => {
    await expect(createCareerGoal('u', { name: ' ', why: null, deadline: null, importance: null }, repo() as never)).rejects.toMatchObject({ field: 'name' })
  })

  it('take a location criterion among the person’s places only', async () => {
    const r = repo()
    await addCriterion('u', 'open', { kind: 'choice', level: 'REQUIRED', dimension: 'location', accepted: ['Abidjan'] }, r as never)
    expect(r.addCondition).toHaveBeenCalledWith('u', 'open', expect.objectContaining({ operator: 'IN', acceptedValues: ['Abidjan'] }))
    await expect(addCriterion('u', 'open', { kind: 'choice', level: 'REQUIRED', dimension: 'location', accepted: ['Paris'] }, r as never)).rejects.toMatchObject({
      field: 'accepted',
    })
  })

  it('take judgements on judgement criteria only', async () => {
    const r = repo()
    await judge('u', 'c', 'MET', ' Good team ', now, r as never)
    expect(r.addJudgement).toHaveBeenCalledWith('c', { subjectType: 'SELF', subjectId: null, result: 'MET', note: 'Good team', judgedAt: now })

    const numeric = repo({ getCondition: vi.fn(async () => ({ id: 'c', goalId: 'open', ...conditionOf({ kind: 'number', level: 'REQUIRED', dimension: 'weekly_hours', operator: 'LTE', target: 40 }) })) })
    await expect(judge('u', 'c', 'MET', null, now, numeric as never)).rejects.toThrow()
  })

  it('mark the main position reviewed from a pay criterion', async () => {
    const r = repo({ getCondition: vi.fn(async () => ({ id: 'c', goalId: 'open', ...conditionOf({ kind: 'number', level: 'REQUIRED', dimension: 'monthly_compensation', operator: 'GTE', target: 1 }) })) })
    await markCriterionReviewed('u', 'c', now, r as never)
    expect(r.updateFact).toHaveBeenCalledWith('u', 'p1', { lastReviewedAt: now })
  })

  it('are replaced only by another of the person’s goals', async () => {
    await expect(supersedeGoal('u', 'open', 'open', now, repo() as never)).rejects.toMatchObject({ field: 'byId' })
    await expect(supersedeGoal('u', 'open', 'someone-else', now, repo() as never)).rejects.toMatchObject({ field: 'byId' })
    const r = repo()
    await supersedeGoal('u', 'open', 'done', now, r as never)
    expect(r.updateGoal).toHaveBeenCalledWith('u', 'open', { supersededAt: now, supersededById: 'done' })
  })
})

describe('saving for a Career goal', () => {
  it('creates a Finance savings goal named after it, and keeps the link', async () => {
    const r = repo({ createSavings: vi.fn(async () => ({ id: 'fin1' })) })
    await saveForGoal('u', 'open', { targetAmount: 900000, alreadySaved: 100000 }, r as never)
    expect(r.createSavings).toHaveBeenCalledWith('u', { name: 'open', targetAmount: 900000, alreadySaved: 100000 })
    expect(r.updateGoal).toHaveBeenCalledWith('u', 'open', { linkedGoalId: 'fin1' })
  })

  it('happens once, and says Finance’s refusal in Career’s words', async () => {
    const linked = repo({ getGoal: vi.fn(async () => storedGoal('open', { linkedGoalId: 'fin1' })), createSavings: vi.fn() })
    await expect(saveForGoal('u', 'open', { targetAmount: 1, alreadySaved: 0 }, linked as never)).rejects.toThrow('already saved for')
    expect(linked.createSavings).not.toHaveBeenCalled()

    const refused = repo({ createSavings: vi.fn(async () => Promise.reject(new FinanceRuleError('You already have a chest with this name.', 'name'))) })
    await expect(saveForGoal('u', 'open', { targetAmount: 1, alreadySaved: 0 }, refused as never)).rejects.toMatchObject({ name: 'CareerRuleError' })
  })
})
