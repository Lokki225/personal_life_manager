import type { FactInput, FactSource } from '../../domain/career/situation'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Career facts and evidence. Every method takes the owner's id and reads or
// writes only their rows (security plan F1): compensation is sensitive.

const FACT_INCLUDE = { evidence: { select: { evidenceId: true } } } as const

export const careerRepository = {
  listFacts: async (userId: string) => {
    return prisma.careerFact.findMany({
      where: { userId },
      include: FACT_INCLUDE,
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    })
  },

  getFact: async (userId: string, id: string) => {
    return prisma.careerFact.findFirst({ where: { id, userId }, include: FACT_INCLUDE })
  },

  createFact: async (userId: string, data: FactInput) => {
    return prisma.careerFact.create({ data: { userId, origin: currentOrigin(), ...data }, select: { id: true } })
  },

  // Resolves to false when the fact is not this person's.
  updateFact: async (
    userId: string,
    id: string,
    data: Partial<FactInput> & { source?: FactSource; lastReviewedAt?: Date; financeIncomeId?: string | null; isPrimary?: boolean },
  ) => {
    const { count } = await prisma.careerFact.updateMany({ where: { id, userId }, data })
    return count > 0
  },

  // One primary position at most: this one, the others unmarked.
  setPrimary: async (userId: string, id: string) => {
    await prisma.$transaction([
      prisma.careerFact.updateMany({ where: { userId, kind: 'POSITION', id: { not: id } }, data: { isPrimary: false } }),
      prisma.careerFact.updateMany({ where: { userId, kind: 'POSITION', id }, data: { isPrimary: true } }),
    ])
  },

  // How many evidence items each of these facts has.
  evidenceCounts: async (userId: string, factIds: string[]) => {
    const rows = await prisma.careerEvidenceLink.groupBy({
      by: ['factId'],
      where: { factId: { in: factIds }, fact: { userId } },
      _count: { _all: true },
    })
    return new Map(rows.map((row) => [row.factId, row._count._all]))
  },

  // The ids among these that are this person's facts.
  ownedFactIds: async (userId: string, factIds: string[]) => {
    if (factIds.length === 0) return new Set<string>()
    const rows = await prisma.careerFact.findMany({ where: { userId, id: { in: factIds } }, select: { id: true } })
    return new Set(rows.map((row) => row.id))
  },

  listEvidence: async (userId: string) => {
    return prisma.careerEvidence.findMany({
      where: { userId },
      include: { facts: { select: { factId: true } } },
      orderBy: { addedAt: 'desc' },
    })
  },

  getEvidence: async (userId: string, id: string) => {
    return prisma.careerEvidence.findFirst({ where: { id, userId }, include: { facts: { select: { factId: true } } } })
  },

  // The fact ids must already be checked as this person's.
  createEvidence: async (userId: string, data: { title: string; url: string | null; description: string | null }, factIds: string[]) => {
    return prisma.careerEvidence.create({
      data: { userId, origin: currentOrigin(), ...data, facts: { create: factIds.map((factId) => ({ factId })) } },
      select: { id: true },
    })
  },

  // Both must be this person's; resolves to false otherwise.
  link: async (userId: string, evidenceId: string, factId: string) => {
    const [evidence, fact] = await Promise.all([
      prisma.careerEvidence.count({ where: { id: evidenceId, userId } }),
      prisma.careerFact.count({ where: { id: factId, userId } }),
    ])
    if (evidence === 0 || fact === 0) return false
    await prisma.careerEvidenceLink.upsert({
      where: { evidenceId_factId: { evidenceId, factId } },
      create: { evidenceId, factId },
      update: {},
    })
    return true
  },

  unlink: async (userId: string, evidenceId: string, factId: string) => {
    await prisma.careerEvidenceLink.deleteMany({ where: { evidenceId, factId, evidence: { userId } } })
  },

  deleteEvidence: async (userId: string, id: string) => {
    const { count } = await prisma.careerEvidence.deleteMany({ where: { id, userId } })
    return count > 0
  },

  getLocations: async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { careerLocations: true } })
    const list = user?.careerLocations
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
  },

  setLocations: async (userId: string, places: string[]) => {
    await prisma.user.update({ where: { id: userId }, data: { careerLocations: places } })
  },
}

export type CareerRepository = typeof careerRepository
