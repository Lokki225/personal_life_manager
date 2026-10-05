import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addCriterion, createCareerGoal, getCareerGoal, judge, saveForGoal } from '@/application/career/goals'
import { writeLog } from '@/application/career/log'
import { acceptOffer, addOpportunity, getOpportunity } from '@/application/career/opportunities'
import { getCareerReview } from '@/application/career/review'
import { addFocus, getWeek, setFocusDone } from '@/application/career/week'
import { addEvidence, addFact, addSkillFromGoal, getSituation } from '@/application/career/situation'
import { createPersonalGoal, setCareerRelevant } from '@/application/personal/goals'
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

describe('scenario 6: the weekly loop', () => {
  it('logs a passed certification, documents it, and the review shows what changed', async () => {
    const goal = (await createCareerGoal(userId, { name: 'Cloud role', why: null, deadline: null, importance: null })).id
    await addCriterion(userId, goal, { kind: 'evidence', level: 'REQUIRED', factKind: 'QUALIFICATION', match: 'AWS SAA' })

    const focus = []
    for (const title of ['Book the exam', 'Update the CV', 'Call Awa']) focus.push((await addFocus(userId, { title, goalId: goal, opportunityId: null })).id)
    await expect(addFocus(userId, { title: 'A fourth', goalId: null, opportunityId: null })).rejects.toThrow('Three focus items')
    await setFocusDone(userId, focus[0], true)

    await writeLog(userId, { body: 'Passed AWS SAA today.', goalId: goal, opportunityId: null, also: { kind: 'newFact', factKind: 'QUALIFICATION', title: 'AWS SAA' } })
    const fact = (await prisma.careerFact.findFirst({ where: { userId, title: 'AWS SAA' } }))!
    await writeLog(userId, {
      body: 'The certificate arrived.',
      goalId: null,
      opportunityId: null,
      also: { kind: 'evidence', factId: fact.id, title: 'Credly badge', url: 'https://example.com/badge' },
    })

    const week = await getWeek(userId)
    expect(week.focus.map((f) => [f.title, f.status])).toEqual([
      ['Book the exam', 'DONE'],
      ['Update the CV', 'OPEN'],
      ['Call Awa', 'OPEN'],
    ])
    expect(week.log.map((e) => e.body?.split('\n')[0])).toEqual(['The certificate arrived.', 'Passed AWS SAA today.'])

    // The log lines link to the goal and the fact, in the shared journal.
    const links = await prisma.journalLink.findMany({ where: { entry: { userId, type: 'CAREER_LOG' } }, select: { targetType: true, targetId: true } })
    expect(links).toEqual(expect.arrayContaining([{ targetType: 'careerGoal', targetId: goal }, { targetType: 'careerFact', targetId: fact.id }]))

    const review = await getCareerReview(userId, new Date())
    expect(review.started.map((f) => f.title)).toContain('AWS SAA')
    expect(review.evidence.map((e) => e.title)).toEqual(['Credly badge'])
    // Other goals of this test account changed too: it was created this week.
    expect(review.criteria.filter((c) => c.goal === 'Cloud role')).toMatchObject([{ from: 'GAP', to: 'MET' }])
    expect(review.focusDone).toEqual(['Book the exam'])
    expect(review.focusOpen).toEqual(['Update the CV', 'Call Awa'])
  })
})

describe('the cost of a goal', () => {
  it('is saved for in Finance, and its progress shows on the Career goal', async () => {
    const goal = (await createCareerGoal(userId, { name: 'Cloud certification', why: null, deadline: null, importance: null })).id
    await saveForGoal(userId, goal, { targetAmount: 300000, alreadySaved: 120000 })

    expect((await getCareerGoal(userId, goal))!.savings).toEqual({ name: 'Cloud certification', saved: 120000, target: 300000 })
    expect(await prisma.goal.count({ where: { userId, domain: 'finance', name: 'Cloud certification' } })).toBe(1)
    await expect(saveForGoal(userId, goal, { targetAmount: 1, alreadySaved: 0 })).rejects.toThrow('already saved for')
  })
})

describe('scenario 7: Personal → Career', () => {
  it('offers a reached Personal goal that counts for the career as a skill, once', async () => {
    const learn = (
      await createPersonalGoal(userId, { preset: 'milestones', name: 'Rust', horizon: 'YEAR', deadline: null, categoryId: null, milestones: ['Book'] }, now)
    ).id
    await setCareerRelevant(userId, learn, true)
    expect((await getSituation(userId)).suggestions).toEqual([])

    // Reached: the Personal engine stamps the day.
    await prisma.goal.update({ where: { id: learn }, data: { achievedAt: today } })
    expect((await getSituation(userId)).suggestions.map((g) => g.name)).toEqual(['Rust'])

    await addSkillFromGoal(userId, learn)
    const situation = await getSituation(userId)
    expect(situation.byKind.SKILL.map((f) => f.title)).toContain('Rust')
    expect(situation.suggestions).toEqual([])
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
