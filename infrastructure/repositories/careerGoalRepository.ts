import type { GoalCondition } from '../../domain/goals/engine'
import type { CareerEvidence } from '../../domain/goals/careerSources'
import { prisma } from '../prisma/client'
import { careerRepository } from './careerRepository'
import { conditionData, toGoalCondition } from './goalRows'

// Career goals: shared Goal rows with domain "career", one ALL group of
// criteria, and the judgements on them. Every method is scoped to the owner.

const DOMAIN = 'career'

const GOAL_INCLUDE = {
  groups: {
    where: { parentGroupId: null, milestoneId: null, role: 'COMPLETION' as const },
    include: { conditions: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] } },
    take: 1,
  },
}

type GoalRow = NonNullable<Awaited<ReturnType<typeof findGoal>>>

const findGoal = (userId: string, id: string) => prisma.goal.findFirst({ where: { id, userId, domain: DOMAIN }, include: GOAL_INCLUDE })

const toCareerGoal = (row: GoalRow) => {
  const group = row.groups[0]
  return {
    id: row.id,
    name: row.name,
    why: row.why,
    importance: row.importance,
    deadline: row.deadline,
    startDate: row.startDate,
    achievedAt: row.achievedAt,
    abandonedAt: row.abandonedAt,
    abandonReason: row.abandonReason,
    pausedAt: row.pausedAt,
    supersededAt: row.supersededAt,
    supersededById: row.supersededById,
    createdAt: row.createdAt,
    group: {
      id: group?.id ?? `${row.id}-criteria`,
      logic: group?.logic ?? ('ALL' as const),
      role: 'COMPLETION' as const,
      conditions: (group?.conditions ?? []).map(toGoalCondition),
      children: [],
    },
  }
}

export type StoredCareerGoal = ReturnType<typeof toCareerGoal>

export type CareerGoalFields = { name: string; why: string | null; deadline: Date | null; importance: 'LOW' | 'MEDIUM' | 'HIGH' | null }

export type CareerGoalState = Partial<{
  achievedAt: Date | null
  pausedAt: Date | null
  supersededAt: Date | null
  supersededById: string | null
  abandonedAt: Date | null
  abandonReason: string | null
}>

export const careerGoalRepository = {
  listGoals: async (userId: string) => {
    const rows = await prisma.goal.findMany({ where: { userId, domain: DOMAIN }, include: GOAL_INCLUDE, orderBy: { createdAt: 'desc' } })
    return rows.map(toCareerGoal)
  },

  getGoal: async (userId: string, id: string) => {
    const row = await findGoal(userId, id)
    return row ? toCareerGoal(row) : null
  },

  createGoal: async (userId: string, fields: CareerGoalFields) => {
    return prisma.goal.create({
      data: {
        userId,
        domain: DOMAIN,
        ...fields,
        lifecycle: 'TERMINAL',
        latch: true,
        achievementMode: 'CONFIRM',
        groups: { create: { logic: 'ALL', role: 'COMPLETION' } },
      },
      select: { id: true },
    })
  },

  updateGoal: async (userId: string, id: string, fields: CareerGoalFields | CareerGoalState) => {
    const { count } = await prisma.goal.updateMany({ where: { id, userId, domain: DOMAIN }, data: fields })
    return count > 0
  },

  // Adds a criterion at the end; resolves to null when the goal is not theirs.
  addCondition: async (userId: string, goalId: string, condition: Omit<GoalCondition, 'id'>) => {
    const group = await prisma.conditionGroup.findFirst({
      where: { goal: { id: goalId, userId, domain: DOMAIN }, role: 'COMPLETION', parentGroupId: null, milestoneId: null },
      select: { id: true, _count: { select: { conditions: true } } },
    })
    if (!group) return null
    return prisma.condition.create({
      data: { groupId: group.id, ...conditionData(condition), sortOrder: group._count.conditions },
      select: { id: true },
    })
  },

  deleteCondition: async (userId: string, goalId: string, conditionId: string) => {
    const { count } = await prisma.condition.deleteMany({ where: { id: conditionId, group: { goal: { id: goalId, userId, domain: DOMAIN } } } })
    return count > 0
  },

  // The condition when it is one of this person's Career criteria.
  getCondition: async (userId: string, conditionId: string) => {
    const row = await prisma.condition.findFirst({
      where: { id: conditionId, group: { goal: { userId, domain: DOMAIN } } },
      include: { group: { select: { goalId: true } } },
    })
    return row ? { ...toGoalCondition(row), goalId: row.group.goalId } : null
  },

  addJudgement: async (
    conditionId: string,
    judgement: { subjectType: 'SELF' | 'OPPORTUNITY'; subjectId: string | null; result: 'MET' | 'GAP' | 'UNKNOWN'; note: string | null; judgedAt: Date },
  ) => {
    await prisma.conditionJudgement.create({ data: { conditionId, ...judgement } })
  },

  // The opportunities linked to a goal, for its side-by-side table.
  linkedOpportunities: async (userId: string, goalId: string) => {
    return prisma.careerOpportunity.findMany({
      where: { userId, goals: { some: { goalId } } },
      select: { id: true, title: true, status: true, outcome: true },
      orderBy: { createdAt: 'asc' },
    })
  },

  // The latest judgement per criterion about one subject, for copying.
  judgementsAbout: async (userId: string, subjectType: 'SELF' | 'OPPORTUNITY', subjectId: string | null) => {
    return prisma.conditionJudgement.findMany({
      where: { subjectType, subjectId, condition: { group: { goal: { userId, domain: DOMAIN } } } },
      orderBy: { judgedAt: 'desc' },
      select: { conditionId: true, result: true, note: true, judgedAt: true },
    })
  },

  // Everything the Career sources read, for this person, in a few queries.
  // With the date each fact's evidence was linked, to see the data as it stood.
  loadEvidence: async (userId: string): Promise<CareerEvidence & { evidenceDates: Map<string, Date[]> }> => {
    const [facts, opportunities, judgements] = await Promise.all([
      careerRepository.listFacts(userId),
      prisma.careerOpportunity.findMany({
        where: { userId },
        select: { id: true, title: true, monthlyCompensation: true, workArrangement: true, contractType: true, weeklyHours: true, location: true, updatedAt: true },
      }),
      prisma.conditionJudgement.findMany({
        where: { condition: { group: { goal: { userId, domain: DOMAIN } } } },
        select: { conditionId: true, subjectType: true, subjectId: true, result: true, judgedAt: true },
      }),
    ])

    return {
      facts: facts.map((f) => ({
        id: f.id,
        kind: f.kind,
        title: f.title,
        validFrom: f.validFrom,
        validTo: f.validTo,
        source: f.source,
        isPrimary: f.isPrimary,
        lastReviewedAt: f.lastReviewedAt,
        createdAt: f.createdAt,
        evidenceCount: f.evidence.length,
        monthlyCompensation: f.monthlyCompensation === null ? null : Number(f.monthlyCompensation),
        workArrangement: f.workArrangement,
        contractType: f.contractType,
        weeklyHours: f.weeklyHours,
        location: f.location,
      })),
      opportunities: opportunities.map((o) => ({ ...o, monthlyCompensation: o.monthlyCompensation === null ? null : Number(o.monthlyCompensation) })),
      judgements,
      evidenceDates: new Map(facts.map((f) => [f.id, f.evidence.map((e) => e.evidence.addedAt)])),
    }
  },
}

export type CareerGoalRepository = typeof careerGoalRepository
