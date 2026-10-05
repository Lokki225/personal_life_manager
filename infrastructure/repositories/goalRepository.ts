import type { ConditionGroup } from '../../domain/goals/engine'
import type { GoalTree } from '../../domain/goals/personalGoal'
import type { PersonalEvidence } from '../../domain/goals/personalSources'
import type { GoalPlan } from '../../domain/goals/presets'
import { prisma } from '../prisma/client'
import { conditionData, toGoalCondition } from './goalRows'

// Goals of the shared engine for nodes other than Finance: the whole tree
// (completion and health groups, one level of child groups, milestones).

const GROUP_INCLUDE = {
  conditions: { orderBy: { id: 'asc' as const } },
  children: { include: { conditions: { orderBy: { id: 'asc' as const } } } },
}

const TREE_INCLUDE = {
  category: { select: { id: true, name: true } },
  lifeArea: { select: { id: true, name: true, color: true, icon: true } },
  groups: { where: { parentGroupId: null, milestoneId: null }, include: GROUP_INCLUDE },
  milestones: { orderBy: { order: 'asc' as const }, include: { groups: { where: { parentGroupId: null }, include: GROUP_INCLUDE } } },
}

type GroupRow = {
  id: string
  logic: 'ALL' | 'ANY'
  role: 'COMPLETION' | 'HEALTH'
  conditions: Parameters<typeof toGoalCondition>[0][]
  children?: GroupRow[]
}

const toGroup = (row: GroupRow): ConditionGroup => ({
  id: row.id,
  logic: row.logic,
  role: row.role,
  conditions: row.conditions.map(toGoalCondition),
  children: (row.children ?? []).map(toGroup),
})

async function findTrees(where: { userId: string; domain: string; id?: string }) {
  const rows = await prisma.goal.findMany({ where, include: TREE_INCLUDE, orderBy: { createdAt: 'desc' } })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    horizon: row.horizon,
    category: row.category,
    createdAt: row.createdAt,
    tree: {
      id: row.id,
      lifecycle: row.lifecycle,
      latch: row.latch,
      startDate: row.startDate,
      deadline: row.deadline,
      achievedAt: row.achievedAt,
      abandonedAt: row.abandonedAt,
      achievementMode: row.achievementMode,
      pausedAt: row.pausedAt,
      supersededAt: row.supersededAt,
      groups: row.groups.map(toGroup),
      milestones: row.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        order: m.order,
        completedAt: m.completedAt,
        groups: m.groups.map(toGroup),
      })),
    } satisfies GoalTree,
    abandonReason: row.abandonReason,
    careerRelevant: row.careerRelevant,
    lifeArea: row.lifeArea,
  }))
}

export type StoredGoal = Awaited<ReturnType<typeof findTrees>>[number]

export const goalRepository = {
  createFromPlan: async (userId: string, plan: GoalPlan) => {
    return prisma.goal.create({
      data: {
        userId,
        name: plan.name,
        domain: plan.domain,
        lifecycle: plan.lifecycle,
        latch: plan.latch,
        horizon: plan.horizon,
        deadline: plan.deadline,
        categoryId: plan.categoryId,
        groups: {
          create: plan.groups.map((group) => ({
            logic: group.logic,
            role: group.role,
            conditions: { create: group.conditions.map(conditionData) },
          })),
        },
        milestones: { create: plan.milestones },
      },
      select: { id: true },
    })
  },

  listTrees: (userId: string, domain: string) => findTrees({ userId, domain }),

  getTree: async (userId: string, id: string, domain: string) => (await findTrees({ userId, domain, id }))[0] ?? null,

  // Records milestones done and goals achieved, only the first time.
  stamp: async (milestoneIds: string[], achievedGoalIds: string[], at: Date) => {
    if (milestoneIds.length === 0 && achievedGoalIds.length === 0) return

    await prisma.$transaction([
      prisma.milestone.updateMany({ where: { id: { in: milestoneIds }, completedAt: null }, data: { completedAt: at } }),
      prisma.goal.updateMany({ where: { id: { in: achievedGoalIds }, achievedAt: null }, data: { achievedAt: at } }),
    ])
  },

  // Whether a Personal goal counts for the career.
  setCareerRelevant: async (userId: string, id: string, value: boolean) => {
    const { count } = await prisma.goal.updateMany({ where: { id, userId, domain: 'personal' }, data: { careerRelevant: value } })
    return count > 0
  },

  abandon: async (userId: string, id: string, reason: string | null, at: Date) => {
    const { count } = await prisma.goal.updateMany({
      where: { id, userId, abandonedAt: null },
      data: { abandonedAt: at, abandonReason: reason },
    })
    return count > 0
  },

  addMilestone: async (userId: string, goalId: string, name: string) => {
    const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { _count: { select: { milestones: true } } } })
    if (!goal) return null
    return prisma.milestone.create({ data: { goalId, name, order: goal._count.milestones }, select: { id: true } })
  },

  // Everything the Personal sources read, for these goals, in a few queries.
  loadEvidence: async (userId: string, goalIds: string[], seriesIds: string[]): Promise<PersonalEvidence> => {
    if (goalIds.length === 0) {
      return { tasks: [], completions: [], sessions: [], entries: [], milestones: [] }
    }

    const [tasks, sessions, entries] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: { not: 'DROPPED' }, OR: [{ goalId: { in: goalIds } }, { milestone: { goalId: { in: goalIds } } }] },
        select: { id: true, goalId: true, milestoneId: true, createdAt: true, status: true, milestone: { select: { goalId: true } } },
      }),
      prisma.session.findMany({
        where: { userId, goalId: { in: goalIds }, endedAt: { not: null } },
        select: { goalId: true, startedAt: true, durationMin: true },
      }),
      seriesIds.length > 0
        ? prisma.metricEntry.findMany({ where: { seriesId: { in: seriesIds }, series: { userId } }, select: { seriesId: true, value: true, recordedAt: true } })
        : Promise.resolve([]),
    ])
    const completions = await prisma.taskCompletion.findMany({
      where: { taskId: { in: tasks.map((t) => t.id) } },
      select: { taskId: true, occurrenceDate: true },
    })

    return {
      // A milestone's task counts for the milestone's goal too.
      tasks: tasks.map((t) => ({ id: t.id, goalId: t.goalId ?? t.milestone?.goalId ?? null, milestoneId: t.milestoneId, createdAt: t.createdAt, done: t.status === 'DONE' })),
      completions,
      sessions: sessions.map((s) => ({ goalId: s.goalId, startedAt: s.startedAt, durationMin: s.durationMin ?? 0 })),
      entries: entries.map((e) => ({ seriesId: e.seriesId, value: Number(e.value), recordedAt: e.recordedAt })),
      milestones: [],
    }
  },
}

export type GoalRepository = typeof goalRepository
