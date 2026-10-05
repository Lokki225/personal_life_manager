import { describe, expect, it, vi } from 'vitest'

import { acceptOffer, addOpportunity, moveOpportunity } from './opportunities'

const now = new Date(2026, 9, 7, 12)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)

const offer = {
  id: 'o1',
  title: 'Software Engineer',
  organisation: 'Beta',
  kind: 'JOB' as const,
  sourceUrl: null,
  notes: null,
  deadline: null,
  status: 'OFFER' as const,
  outcome: null,
  monthlyCompensation: 700000,
  workArrangement: 'hybrid',
  contractType: 'permanent',
  weeklyHours: 40,
  location: null,
  createdAt: now,
  updatedAt: now,
  goals: [],
  statusChanges: [],
}

const currentPosition = {
  id: 'p1',
  kind: 'POSITION' as const,
  title: 'RPA Developer',
  validFrom: day(2024, 1, 1),
  validTo: null,
  source: 'SELF' as const,
  isPrimary: true,
  lastReviewedAt: null,
  createdAt: day(2024, 1, 1),
  evidenceCount: 0,
  monthlyCompensation: 450000,
  workArrangement: 'on_site',
  contractType: null,
  weeklyHours: null,
  location: null,
}

function deps() {
  return {
    opportunities: {
      get: vi.fn(async (_u: string, id: string) => (id === 'o1' ? offer : null)),
      setStatus: vi.fn(async () => true),
      create: vi.fn(async () => ({ id: 'new' })),
      ownedGoalIds: vi.fn(async (_u: string, ids: string[]) => new Set(ids.filter((id) => id.startsWith('g')))),
    },
    goals: {
      loadEvidence: vi.fn(async () => ({ facts: [currentPosition], opportunities: [], judgements: [] })),
      judgementsAbout: vi.fn(async () => [
        { conditionId: 'c1', result: 'MET' as const, note: 'Good team', judgedAt: day(2026, 10, 2) },
        { conditionId: 'c1', result: 'GAP' as const, note: null, judgedAt: day(2026, 9, 1) },
        { conditionId: 'c2', result: 'GAP' as const, note: null, judgedAt: day(2026, 10, 1) },
      ]),
      addJudgement: vi.fn(async () => {}),
    },
    facts: {
      createFact: vi.fn(async () => ({ id: 'p2' })),
      updateFact: vi.fn(async () => true),
      setPrimary: vi.fn(async () => {}),
      ownedFactIds: vi.fn(async () => new Set<string>()),
    },
    listIncomes: vi.fn(async () => [{ id: 'i1', source: 'Salary', amount: 700000 }]),
  }
}

const choices = { createPosition: true, startsOn: day(2026, 11, 1), endCurrent: true, incomeId: 'i1', copyJudgements: true }

describe('accepting an offer', () => {
  it('ends the current position, creates the new main one from the terms, links its pay and copies the judgements', async () => {
    const d = deps()
    await acceptOffer('u', 'o1', choices, now, d as never)

    expect(d.facts.updateFact).toHaveBeenCalledWith('u', 'p1', { validTo: day(2026, 11, 1) })
    expect(d.facts.createFact).toHaveBeenCalledWith('u', expect.objectContaining({ kind: 'POSITION', title: 'Software Engineer', monthlyCompensation: 700000, validFrom: day(2026, 11, 1) }))
    expect(d.facts.setPrimary).toHaveBeenCalledWith('u', 'p2')
    expect(d.facts.updateFact).toHaveBeenCalledWith('u', 'p2', { financeIncomeId: 'i1' })
    // The latest judgement per criterion, now about the situation.
    expect(d.goals.addJudgement.mock.calls).toEqual([
      ['c1', { subjectType: 'SELF', subjectId: null, result: 'MET', note: 'Good team', judgedAt: now }],
      ['c2', { subjectType: 'SELF', subjectId: null, result: 'GAP', note: null, judgedAt: now }],
    ])
    expect(d.opportunities.setStatus).toHaveBeenCalledWith('u', 'o1', 'CLOSED', 'accepted', now)
  })

  it('does only what was chosen', async () => {
    const d = deps()
    await acceptOffer('u', 'o1', { ...choices, createPosition: false, endCurrent: false, incomeId: null, copyJudgements: false }, now, d as never)
    expect(d.facts.createFact).not.toHaveBeenCalled()
    expect(d.facts.updateFact).not.toHaveBeenCalled()
    expect(d.goals.addJudgement).not.toHaveBeenCalled()
    expect(d.opportunities.setStatus).toHaveBeenCalled()
  })

  it('refuses an income that is not the person’s, before changing anything', async () => {
    const d = deps()
    await expect(acceptOffer('u', 'o1', { ...choices, incomeId: 'x9' }, now, d as never)).rejects.toMatchObject({ field: 'incomeId' })
    expect(d.facts.createFact).not.toHaveBeenCalled()
    expect(d.opportunities.setStatus).not.toHaveBeenCalled()
  })
})

describe('opportunities', () => {
  it('link only the person’s own goals', async () => {
    const d = deps()
    const input = { ...offer, deadline: null }
    await expect(addOpportunity('u', input, ['g1', 'x9'], d as never)).rejects.toMatchObject({ field: 'goalIds' })
    await addOpportunity('u', input, ['g1'], d as never)
    expect(d.opportunities.create).toHaveBeenCalledWith('u', expect.objectContaining({ title: 'Software Engineer' }), ['g1'], expect.any(Date))
  })

  it('say how they ended when closed', async () => {
    await expect(moveOpportunity('u', 'o1', 'CLOSED', null, now, deps() as never)).rejects.toMatchObject({ field: 'outcome' })
  })
})
