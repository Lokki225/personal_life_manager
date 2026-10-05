import type { AreaInput } from '../../domain/lifeAreas/areas'
import { prisma } from '../prisma/client'

// Life areas, shared by every node. Every method is scoped to the owner.

export const lifeAreaRepository = {
  list: async (userId: string) => {
    return prisma.lifeArea.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { goals: true } } },
    })
  },

  create: async (userId: string, data: AreaInput, sortOrder: number) => {
    return prisma.lifeArea.create({ data: { userId, ...data, sortOrder }, select: { id: true } })
  },

  update: async (userId: string, id: string, data: AreaInput) => {
    const { count } = await prisma.lifeArea.updateMany({ where: { id, userId }, data })
    return count > 0
  },

  // Goals keep working: their area is cleared by the database.
  remove: async (userId: string, id: string) => {
    const { count } = await prisma.lifeArea.deleteMany({ where: { id, userId } })
    return count > 0
  },

  reorder: async (userId: string, ids: string[]) => {
    await prisma.$transaction(ids.map((id, sortOrder) => prisma.lifeArea.updateMany({ where: { id, userId }, data: { sortOrder } })))
  },

  owns: async (userId: string, id: string) => (await prisma.lifeArea.count({ where: { id, userId } })) > 0,

  // Sets the area of one of the person's goals, in any node but Finance.
  setGoalArea: async (userId: string, goalId: string, lifeAreaId: string | null) => {
    const { count } = await prisma.goal.updateMany({ where: { id: goalId, userId, domain: { in: ['personal', 'career'] } }, data: { lifeAreaId } })
    return count > 0
  },
}

export type LifeAreaRepository = typeof lifeAreaRepository
