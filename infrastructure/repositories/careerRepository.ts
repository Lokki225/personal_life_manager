import type { FactInput, FactSource } from '../../domain/career/situation'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Career facts and evidence. Every method takes the owner's id and reads or
// writes only their rows (security plan F1): compensation is sensitive.

const FACT_INCLUDE = { evidence: { select: { evidenceId: true, evidence: { select: { addedAt: true } } } } } as const

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

  createFact: async (userId: string, data: FactInput & { financeIncomeId?: string | null }) => {
    return prisma.careerFact.create({ data: { userId, origin: currentOrigin(), ...data }, select: { id: true } })
  },

  // The person's plan incomes a position's pay can come from.
  listIncomes: async (userId: string) => {
    const rows = await prisma.income.findMany({
      where: { userId, payDay: { not: null } },
      select: { id: true, source: true, amount: true, frequency: true },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }))
  },

  // Personal goals that count for the career, achieved, whose offer to become
  // a skill is not answered yet.
  listSkillSuggestions: async (userId: string) => {
    return prisma.goal.findMany({
      where: { userId, domain: 'personal', careerRelevant: true, achievedAt: { not: null }, careerPromptAnsweredAt: null },
      select: { id: true, name: true, achievedAt: true },
      orderBy: { achievedAt: 'desc' },
    })
  },

  answerSkillSuggestion: async (userId: string, goalId: string, at: Date) => {
    const { count } = await prisma.goal.updateMany({
      where: { id: goalId, userId, domain: 'personal', careerRelevant: true, careerPromptAnsweredAt: null },
      data: { careerPromptAnsweredAt: at },
    })
    return count > 0
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
  createEvidence: async (userId: string, data: { title: string; url: string | null; description: string | null; addedAt?: Date }, factIds: string[]) => {
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

  // The day of the weekly reviews: 1 is Monday, 7 is Sunday.
  getReviewDay: async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { reviewDay: true } })
    return user?.reviewDay ?? 7
  },

  setLocations: async (userId: string, places: string[]) => {
    await prisma.user.update({ where: { id: userId }, data: { careerLocations: places } })
  },
}

export type CareerRepository = typeof careerRepository

// Everything a person recorded in Career, for their data export: facts,
// evidence, opportunities with their history, goals with their criteria and
// judgements, focus items. Log lines are in the journal.
export async function exportCareer(userId: string) {
  const [facts, evidence, opportunities, goals, focus] = await Promise.all([
    prisma.careerFact.findMany({ where: { userId }, include: { evidence: { select: { evidenceId: true } } } }),
    prisma.careerEvidence.findMany({ where: { userId }, include: { facts: { select: { factId: true } } } }),
    prisma.careerOpportunity.findMany({ where: { userId }, include: { goals: { select: { goalId: true } }, statusChanges: true } }),
    prisma.goal.findMany({ where: { userId, domain: 'career' }, include: { groups: { include: { conditions: { include: { judgements: true } } } } } }),
    prisma.task.findMany({ where: { userId, domain: 'career' } }),
  ])
  return { facts, evidence, opportunities, goals, focus }
}
