import type { OpportunityInput, OpportunityStatus, Outcome } from '../../domain/career/opportunities'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Career opportunities, their links to Career goals and their status history.
// Every method is scoped to the owner: terms include pay.

const INCLUDE = {
  goals: { select: { goalId: true, goal: { select: { name: true } } } },
  statusChanges: { orderBy: { changedAt: 'desc' as const } },
} as const

const toTerms = <R extends { monthlyCompensation: unknown }>(row: R) => ({
  ...row,
  monthlyCompensation: row.monthlyCompensation === null ? null : Number(row.monthlyCompensation),
})

export const careerOpportunityRepository = {
  list: async (userId: string) => {
    const rows = await prisma.careerOpportunity.findMany({ where: { userId }, include: INCLUDE, orderBy: { createdAt: 'desc' } })
    return rows.map(toTerms)
  },

  get: async (userId: string, id: string) => {
    const row = await prisma.careerOpportunity.findFirst({ where: { id, userId }, include: INCLUDE })
    return row ? toTerms(row) : null
  },

  // The goal ids must already be checked as this person's Career goals.
  create: async (userId: string, data: OpportunityInput, goalIds: string[], at: Date) => {
    return prisma.careerOpportunity.create({
      data: {
        userId,
        origin: currentOrigin(),
        ...data,
        goals: { create: goalIds.map((goalId) => ({ goalId })) },
        statusChanges: { create: { status: 'FOUND', changedAt: at } },
      },
      select: { id: true },
    })
  },

  update: async (userId: string, id: string, data: OpportunityInput) => {
    const { count } = await prisma.careerOpportunity.updateMany({ where: { id, userId }, data })
    return count > 0
  },

  // Moves it in the pipeline and notes the move. False when it is not theirs.
  setStatus: async (userId: string, id: string, status: OpportunityStatus, outcome: Outcome | null, at: Date) => {
    const owned = await prisma.careerOpportunity.count({ where: { id, userId } })
    if (owned === 0) return false
    await prisma.$transaction([
      prisma.careerOpportunity.update({ where: { id }, data: { status, outcome } }),
      prisma.careerStatusChange.create({ data: { opportunityId: id, status, outcome, changedAt: at } }),
    ])
    return true
  },

  // Replaces its goals; the ids must already be checked.
  setGoals: async (userId: string, id: string, goalIds: string[]) => {
    const owned = await prisma.careerOpportunity.count({ where: { id, userId } })
    if (owned === 0) return false
    await prisma.$transaction([
      prisma.careerOpportunityGoal.deleteMany({ where: { opportunityId: id } }),
      prisma.careerOpportunityGoal.createMany({ data: goalIds.map((goalId) => ({ opportunityId: id, goalId })) }),
    ])
    return true
  },

  // Deletes it with its judgements, which only meant something about it.
  remove: async (userId: string, id: string) => {
    const owned = await prisma.careerOpportunity.count({ where: { id, userId } })
    if (owned === 0) return false
    await prisma.$transaction([
      prisma.conditionJudgement.deleteMany({ where: { subjectType: 'OPPORTUNITY', subjectId: id, condition: { group: { goal: { userId } } } } }),
      prisma.careerOpportunity.delete({ where: { id } }),
    ])
    return true
  },

  // The ids among these that are this person's Career goals.
  ownedGoalIds: async (userId: string, goalIds: string[]) => {
    if (goalIds.length === 0) return new Set<string>()
    const rows = await prisma.goal.findMany({ where: { userId, domain: 'career', id: { in: goalIds } }, select: { id: true } })
    return new Set(rows.map((row) => row.id))
  },
}

export type CareerOpportunityRepository = typeof careerOpportunityRepository
