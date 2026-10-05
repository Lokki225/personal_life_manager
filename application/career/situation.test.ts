import { describe, expect, it, vi } from 'vitest'

import type { FactInput } from '../../domain/career/situation'
import { addEvidence, addFact, addSkillFromGoal, declineSkillSuggestion, deleteEvidence, endFact, getSituation, makePrimary, unlinkEvidence, updateFact } from './situation'

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const now = new Date(2026, 9, 7, 12)

const fact = (extra: object = {}) => ({
  id: 'f1',
  userId: 'u',
  kind: 'POSITION' as const,
  title: 'RPA Developer',
  details: null,
  validFrom: day(2024, 1, 1),
  validTo: null as Date | null,
  source: 'SELF' as const,
  isPrimary: false,
  lastReviewedAt: null as Date | null,
  monthlyCompensation: null,
  createdAt: day(2026, 9, 1),
  evidence: [] as { evidenceId: string }[],
  ...extra,
})

function repo(extra: object = {}) {
  return {
    listFacts: vi.fn(async () => [fact(), fact({ id: 'f2', kind: 'SKILL', title: 'Rust' }), fact({ id: 'f3', validTo: day(2025, 1, 1) })]),
    getFact: vi.fn(async (_u: string, id: string) => (id === 'f1' || id === 'f2' ? fact({ id }) : null)),
    createFact: vi.fn(async () => ({ id: 'new' })),
    updateFact: vi.fn(async () => true),
    setPrimary: vi.fn(async () => {}),
    evidenceCounts: vi.fn(async () => new Map([['f1', 1]])),
    ownedFactIds: vi.fn(async (_u: string, ids: string[]) => new Set(ids.filter((id) => id.startsWith('f')))),
    listEvidence: vi.fn(async () => []),
    getEvidence: vi.fn(async () => ({ id: 'e1', facts: [{ factId: 'f1' }] })),
    createEvidence: vi.fn(async () => ({ id: 'e1' })),
    link: vi.fn(async () => true),
    unlink: vi.fn(async () => {}),
    deleteEvidence: vi.fn(async () => true),
    getLocations: vi.fn(async () => ['Abidjan']),
    setLocations: vi.fn(async () => {}),
    listIncomes: vi.fn(async () => [{ id: 'i1', source: 'Salary', amount: 450000, frequency: 'monthly' }]),
    listSkillSuggestions: vi.fn(async () => [{ id: 'pg1', name: 'Rust', achievedAt: new Date(2026, 8, 20, 18) }]),
    answerSkillSuggestion: vi.fn(async () => true),
    ...extra,
  }
}

const input = (extra: Partial<FactInput> = {}): FactInput => ({
  kind: 'POSITION',
  title: 'Developer',
  details: null,
  validFrom: day(2026, 1, 1),
  validTo: null,
  organisation: null,
  monthlyCompensation: 450000,
  workArrangement: null,
  contractType: null,
  weeklyHours: null,
  location: null,
  issuer: null,
  obtainedAt: null,
  expiresAt: null,
  level: null,
  positionId: null,
  ...extra,
})

describe('getSituation', () => {
  it('groups current facts by kind and keeps ended ones as the past', async () => {
    const situation = await getSituation('u', now, repo() as never)
    expect(situation.byKind.POSITION.map((f) => f.id)).toEqual(['f1'])
    expect(situation.byKind.SKILL.map((f) => f.id)).toEqual(['f2'])
    expect(situation.past.map((f) => f.id)).toEqual(['f3'])
    expect(situation.primary).toMatchObject({ fact: { id: 'f1' }, chosen: 'only' })
  })
})

describe('facts', () => {
  it('marks a new position as the main one when asked', async () => {
    const r = repo()
    await addFact('u', { ...input(), primary: true }, r as never)
    expect(r.setPrimary).toHaveBeenCalledWith('u', 'new')
  })

  it('refuses an experience tied to someone else’s position', async () => {
    await expect(addFact('u', input({ kind: 'EXPERIENCE', positionId: 'x9' }), repo() as never)).rejects.toMatchObject({ field: 'positionId' })
  })

  it('takes a confirmation, and otherwise follows the evidence', async () => {
    const r = repo({ getFact: vi.fn(async () => fact({ evidence: [{ evidenceId: 'e1' }] })) })
    await updateFact('u', 'f1', { ...input(), confirmed: false }, r as never)
    await updateFact('u', 'f1', { ...input(), confirmed: true }, r as never)
    expect(r.updateFact.mock.calls.map((c) => (c as unknown[])[2])).toMatchObject([{ source: 'DOCUMENTED' }, { source: 'CONFIRMED' }])
  })

  it('ends a fact, never before it started, and only someone’s own', async () => {
    await expect(endFact('u', 'f1', day(2023, 1, 1), repo() as never)).rejects.toMatchObject({ field: 'validTo' })
    await expect(endFact('u', 'zz', day(2026, 1, 1), repo() as never)).rejects.toThrow('This fact no longer exists.')
  })

  it('makes only a current position the main one', async () => {
    await expect(makePrimary('u', 'f2', now, repo({ getFact: vi.fn(async () => fact({ kind: 'SKILL' })) }) as never)).rejects.toThrow()
    const r = repo()
    await makePrimary('u', 'f1', now, r as never)
    expect(r.setPrimary).toHaveBeenCalledWith('u', 'f1')
  })
})

describe('evidence', () => {
  it('documents the facts it is linked to', async () => {
    const r = repo()
    await addEvidence('u', { title: 'Repository', url: 'https://github.com/me/aos', description: null, factIds: ['f1'] }, r as never)
    expect(r.createEvidence).toHaveBeenCalledWith('u', { title: 'Repository', url: 'https://github.com/me/aos', description: null, addedAt: expect.any(Date) }, ['f1'])
    expect(r.updateFact).toHaveBeenCalledWith('u', 'f1', { source: 'DOCUMENTED' })
  })

  it('refuses a link that is not a web page, and facts that are not the person’s', async () => {
    await expect(addEvidence('u', { title: 'x', url: 'javascript:alert(1)', description: null, factIds: [] }, repo() as never)).rejects.toMatchObject({ field: 'url' })
    await expect(addEvidence('u', { title: 'x', url: null, description: null, factIds: ['x9'] }, repo() as never)).rejects.toMatchObject({ field: 'factIds' })
  })

  it('takes "documented" back when the last evidence goes', async () => {
    const r = repo({ evidenceCounts: vi.fn(async () => new Map()), getFact: vi.fn(async () => fact({ source: 'DOCUMENTED' })) })
    await unlinkEvidence('u', 'e1', 'f1', r as never)
    expect(r.updateFact).toHaveBeenCalledWith('u', 'f1', { source: 'SELF' })

    const r2 = repo({ evidenceCounts: vi.fn(async () => new Map()), getFact: vi.fn(async () => fact({ source: 'DOCUMENTED' })) })
    await deleteEvidence('u', 'e1', r2 as never)
    expect(r2.deleteEvidence).toHaveBeenCalledWith('u', 'e1')
    expect(r2.updateFact).toHaveBeenCalledWith('u', 'f1', { source: 'SELF' })
  })
})

describe('links with Finance and Personal', () => {
  it('takes a position’s pay from a Finance income, keeping no second salary', async () => {
    const r = repo()
    await addFact('u', { ...input({ monthlyCompensation: 450000 }), financeIncomeId: 'i1' }, r as never)
    expect(r.createFact).toHaveBeenCalledWith('u', expect.objectContaining({ financeIncomeId: 'i1', monthlyCompensation: null }))
    await expect(addFact('u', { ...input(), financeIncomeId: 'x9' }, r as never)).rejects.toMatchObject({ field: 'financeIncomeId' })
  })

  it('shows the income a position is paid from', async () => {
    const r = repo({ listFacts: vi.fn(async () => [fact({ financeIncomeId: 'i1' })]) })
    expect((await getSituation('u', now, r as never)).byKind.POSITION[0].income).toEqual({ source: 'Salary', perMonth: 450000 })
  })

  it('turns a Personal goal that counts for the career into a skill, once (scenario 7)', async () => {
    const r = repo()
    await addSkillFromGoal('u', 'pg1', now, r as never)
    expect(r.createFact).toHaveBeenCalledWith('u', expect.objectContaining({ kind: 'SKILL', title: 'Rust', validFrom: new Date(2026, 8, 20) }))
    expect(r.answerSkillSuggestion).toHaveBeenCalledWith('u', 'pg1', now)

    await expect(addSkillFromGoal('u', 'other', now, r as never)).rejects.toThrow('already answered')
    await expect(declineSkillSuggestion('u', 'pg1', now, repo({ answerSkillSuggestion: vi.fn(async () => false) }) as never)).rejects.toThrow()
  })
})
