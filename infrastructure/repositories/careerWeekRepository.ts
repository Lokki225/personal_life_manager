import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Career focus items: shared tasks with domain "career" and the Monday of
// their week. Personal never reads them. Every method is scoped to the owner.

const DOMAIN = 'career'
const SELECT = { id: true, title: true, status: true, focusWeek: true, goalId: true, relatedType: true, relatedId: true, carryCount: true } as const

export const careerWeekRepository = {
  listFocus: async (userId: string, week: Date) => {
    return prisma.task.findMany({
      where: { userId, domain: DOMAIN, focusWeek: week, status: { not: 'DROPPED' } },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    })
  },

  // Open ones from weeks before this one.
  listLeftOver: async (userId: string, week: Date) => {
    return prisma.task.findMany({
      where: { userId, domain: DOMAIN, focusWeek: { lt: week }, status: 'OPEN' },
      select: SELECT,
      orderBy: { focusWeek: 'desc' },
    })
  },

  countFocus: (userId: string, week: Date) => prisma.task.count({ where: { userId, domain: DOMAIN, focusWeek: week, status: { not: 'DROPPED' } } }),

  getFocus: (userId: string, id: string) => prisma.task.findFirst({ where: { id, userId, domain: DOMAIN }, select: SELECT }),

  addFocus: async (userId: string, data: { title: string; week: Date; goalId: string | null; opportunityId: string | null }) => {
    return prisma.task.create({
      data: {
        userId,
        domain: DOMAIN,
        origin: currentOrigin(),
        title: data.title,
        focusWeek: data.week,
        goalId: data.goalId,
        relatedType: data.opportunityId ? 'careerOpportunity' : null,
        relatedId: data.opportunityId,
      },
      select: { id: true },
    })
  },

  setStatus: async (userId: string, id: string, status: 'OPEN' | 'DONE' | 'DROPPED') => {
    const { count } = await prisma.task.updateMany({ where: { id, userId, domain: DOMAIN }, data: { status } })
    return count > 0
  },

  // Moves focus items to another week, counting the move.
  moveFocus: async (userId: string, ids: string[], week: Date) => {
    const { count } = await prisma.task.updateMany({
      where: { id: { in: ids }, userId, domain: DOMAIN },
      data: { focusWeek: week, carryCount: { increment: 1 } },
    })
    return count
  },

  // The ids among these that are this person's Career goals / opportunities.
  ownsGoal: async (userId: string, id: string) => (await prisma.goal.count({ where: { id, userId, domain: DOMAIN } })) > 0,
  ownsOpportunity: async (userId: string, id: string) => (await prisma.careerOpportunity.count({ where: { id, userId } })) > 0,
}

export type CareerWeekRepository = typeof careerWeekRepository
