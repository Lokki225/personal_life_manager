import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addCriterion, createCareerGoal, getCareerGoal, judge } from '@/application/career/goals'
import { acceptOffer, addOpportunity, getOpportunity } from '@/application/career/opportunities'
import { addEvidence, addFact, getSituation } from '@/application/career/situation'
import type { FactInput } from '@/domain/career/situation'
import { prisma } from '@/infrastructure/prisma/client'
import { userRepository } from '@/infrastructure/repositories/userRepository'

// Career spec acceptance scenarios 3 and 4, end to end on the development
// database: the use cases, the repositories and the engine together.

if (/prod/i.test(process.env.VERCEL_ENV ?? '') || process.env.NODE_ENV === 'production') {
  throw new Error('This suite never runs against production.')
}

let userId = ''
const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

const fact = (extra: Partial<FactInput>): FactInput => ({
  kind: 'POSITION',
  title: '',
  details: null,
  validFrom: new Date(2024, 0, 1),
  validTo: null,
  organisation: null,
  monthlyCompensation: null,
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

const offer = (title: string, monthlyCompensation: number, workArrangement: string) => ({
  title,
  organisation: 'Beta',
  kind: 'JOB' as const,
  sourceUrl: null,
  notes: null,
  deadline: null,
  monthlyCompensation,
  workArrangement,
  contractType: null,
  weeklyHours: null,
  location: null,
})

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `career-${Date.now()}@example.invalid`, passwordHash: 'x' } })).id
  await addFact(userId, fact({ title: 'RPA Developer', monthlyCompensation: 450000, workArrangement: 'on_site' }))
})

afterAll(async () => {
  if (userId) await userRepository.deleteAccount(userId)
  await prisma.$disconnect()
})

describe('scenario 4: two offers', () => {
  it('appear side by side with "Now", each criterion per column, and no winner', async () => {
    const goal = (await createCareerGoal(userId, { name: 'A better job', why: null, deadline: null, importance: 'HIGH' })).id
    await addCriterion(userId, goal, { kind: 'number', level: 'REQUIRED', dimension: 'monthly_compensation', operator: 'GTE', target: 600000 })
    await addCriterion(userId, goal, { kind: 'choice', level: 'REQUIRED', dimension: 'work_arrangement', accepted: ['remote', 'hybrid'] })
    await addCriterion(userId, goal, { kind: 'judgement', level: 'PREFERRED', label: 'Interesting work' })
    const first = (await addOpportunity(userId, offer('Offer one', 650000, 'on_site'), [goal])).id
    const second = (await addOpportunity(userId, offer('Offer two', 550000, 'remote'), [goal])).id

    const judgement = (await prisma.condition.findFirst({ where: { group: { goalId: goal }, source: 'JUDGEMENT' } }))!.id
    await judge(userId, judgement, 'MET', 'Platform team', new Date(), undefined, { type: 'OPPORTUNITY', id: second })

    const page = (await getCareerGoal(userId, goal))!
    expect(page.evaluation.results.map((r) => r.result)).toEqual(['GAP', 'GAP', 'UNKNOWN'])
    expect(page.comparison.map((c) => c.title)).toEqual(['Offer one', 'Offer two'])
    expect(page.comparison[0].evaluation.results.map((r) => r.result)).toEqual(['EXCEEDS', 'GAP', 'UNKNOWN'])
    expect(page.comparison[1].evaluation.results.map((r) => r.result)).toEqual(['GAP', 'MET', 'MET'])
    expect(page).not.toHaveProperty('winner')

    const offerPage = (await getOpportunity(userId, first))!
    expect(offerPage.goals[0].criteria.map((c) => c.result.result)).toEqual(['EXCEEDS', 'GAP', 'UNKNOWN'])
  })
})

describe('scenario 3: an unexpected route', () => {
  it('reaches "Criteria met" after accepting an offer and documenting the experience, and nothing is marked failed', async () => {
    const goal = (await createCareerGoal(userId, { name: 'Architecture experience', why: null, deadline: null, importance: null })).id
    await addCriterion(userId, goal, { kind: 'evidence', level: 'REQUIRED', factKind: 'EXPERIENCE', match: 'Led the platform architecture' })
    expect((await getCareerGoal(userId, goal))!.evaluation.status).toBe('IN_PROGRESS')

    const lead = (await addOpportunity(userId, offer('Tech Lead', 900000, 'hybrid'), [goal])).id
    await acceptOffer(userId, lead, { createPosition: true, startsOn: today, endCurrent: true, incomeId: null, copyJudgements: true })

    const situation = await getSituation(userId)
    expect(situation.primary?.fact.title).toBe('Tech Lead')
    expect(situation.past.map((f) => f.title)).toContain('RPA Developer')

    const experience = (await addFact(userId, fact({ kind: 'EXPERIENCE', title: 'Led the platform architecture', validFrom: today, positionId: situation.primary!.fact.id }))).id
    await addEvidence(userId, { title: 'Design document', url: 'https://example.com/design', description: null, factIds: [experience] })

    const page = (await getCareerGoal(userId, goal))!
    expect(page.evaluation.status).toBe('CRITERIA_MET')
    expect(page.achievedAt).toBeNull()
    expect((await getOpportunity(userId, lead))!.status).toBe('CLOSED')
  })
})
