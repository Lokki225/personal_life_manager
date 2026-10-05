import type { ProjectInput, ProjectLinkInput, ProjectStatus } from '../../domain/projects/projects'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Projects, shared by every node. Every method is scoped to the owner
// (security plan F1); money read here never leaves the owner's pages.

const AREA = { select: { id: true, name: true, color: true, icon: true } } as const

export const projectRepository = {
  list: async (userId: string) => {
    return prisma.project.findMany({
      where: { userId },
      include: { lifeArea: AREA },
      orderBy: [{ statusChangedAt: 'desc' }, { createdAt: 'desc' }],
    })
  },

  get: async (userId: string, id: string) => {
    return prisma.project.findFirst({
      where: { id, userId },
      include: {
        lifeArea: AREA,
        links: { orderBy: { sortOrder: 'asc' } },
        statusChanges: { orderBy: { changedAt: 'desc' } },
        releases: { orderBy: { releasedAt: 'desc' } },
      },
    })
  },

  slugs: async (userId: string) => {
    const rows = await prisma.project.findMany({ where: { userId, slug: { not: null } }, select: { slug: true } })
    return new Set(rows.map((r) => r.slug!))
  },

  ownsArea: async (userId: string, id: string) => (await prisma.lifeArea.count({ where: { id, userId } })) > 0,

  create: async (userId: string, data: ProjectInput, links: ProjectLinkInput[], slug: string, status: ProjectStatus, at: Date) => {
    return prisma.project.create({
      data: {
        userId,
        origin: currentOrigin(),
        ...data,
        slug,
        status,
        statusChangedAt: at,
        links: { create: links.map((link, sortOrder) => ({ ...link, sortOrder })) },
        statusChanges: { create: { from: null, to: status, changedAt: at } },
      },
      select: { id: true },
    })
  },

  // Replaces the fields and the links. False when it is not theirs.
  update: async (userId: string, id: string, data: ProjectInput, links: ProjectLinkInput[]) => {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.project.updateMany({ where: { id, userId }, data })
      if (count === 0) return false
      await tx.projectLink.deleteMany({ where: { projectId: id } })
      await tx.projectLink.createMany({ data: links.map((link, sortOrder) => ({ ...link, sortOrder, projectId: id })) })
      return true
    })
  },

  setStatus: async (userId: string, id: string, to: ProjectStatus, reason: string | null, at: Date) => {
    const project = await prisma.project.findFirst({ where: { id, userId }, select: { status: true } })
    if (!project) return false
    await prisma.$transaction([
      prisma.project.update({ where: { id }, data: { status: to, statusChangedAt: at } }),
      prisma.projectStatusChange.create({ data: { projectId: id, from: project.status, to, reason, changedAt: at } }),
    ])
    return true
  },

  // Everything that shows a project's activity, for all the person's
  // projects at once: sessions (direct or through a goal), task
  // completions, devlog entries, releases, expenses and incomes.
  activity: async (userId: string) => {
    const [sessions, completions, devlog, releases, expenses, receipts, oneOff] = await Promise.all([
      prisma.session.findMany({
        where: { userId, endedAt: { not: null }, OR: [{ projectId: { not: null } }, { goal: { projectId: { not: null } } }] },
        select: { id: true, projectId: true, goalId: true, startedAt: true, durationMin: true, goal: { select: { projectId: true } } },
      }),
      prisma.taskCompletion.findMany({ where: { task: { userId, projectId: { not: null } } }, select: { occurrenceDate: true, task: { select: { projectId: true } } } }),
      prisma.journalLink.findMany({
        where: { targetType: 'project', entry: { userId, type: 'PROJECT_LOG' } },
        select: { targetId: true, entry: { select: { entryDate: true } } },
      }),
      prisma.projectRelease.findMany({ where: { project: { userId } }, select: { projectId: true, releasedAt: true } }),
      prisma.expense.findMany({ where: { userId, projectId: { not: null } }, select: { projectId: true, date: true, amount: true } }),
      prisma.incomeReceipt.findMany({ where: { userId, income: { projectId: { not: null } } }, select: { receivedAt: true, amount: true, income: { select: { projectId: true } } } }),
      prisma.income.findMany({ where: { userId, payDay: null, projectId: { not: null } }, select: { projectId: true, actualDate: true, createdAt: true, amount: true } }),
    ])

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        goalProjectId: s.goal?.projectId ?? null,
        goalId: s.goalId,
        startedAt: s.startedAt,
        durationMin: s.durationMin ?? 0,
      })),
      completions: completions.map((c) => ({ projectId: c.task.projectId!, at: c.occurrenceDate })),
      devlog: devlog.map((d) => ({ projectId: d.targetId, at: d.entry.entryDate })),
      releases: releases.map((r) => ({ projectId: r.projectId, at: r.releasedAt })),
      money: [
        ...expenses.map((e) => ({ projectId: e.projectId!, date: e.date, amount: Number(e.amount), flow: 'spent' as const })),
        ...receipts.map((r) => ({ projectId: r.income.projectId!, date: r.receivedAt, amount: Number(r.amount), flow: 'earned' as const })),
        ...oneOff.map((i) => ({ projectId: i.projectId!, date: i.actualDate ?? i.createdAt, amount: Number(i.amount), flow: 'earned' as const })),
      ],
    }
  },

  // The person's goals that belong to a project, from any node.
  goalsOf: async (userId: string, projectId: string) => {
    return prisma.goal.findMany({ where: { userId, projectId }, select: { id: true, name: true, domain: true } })
  },

  // The Finance records of a project, for its Money tab.
  financeRecords: async (userId: string, projectId: string) => {
    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({ where: { userId, projectId }, orderBy: { date: 'desc' }, take: 50, select: { id: true, date: true, amount: true, category: true, description: true } }),
      prisma.income.findMany({ where: { userId, projectId }, orderBy: { createdAt: 'desc' }, select: { id: true, source: true, amount: true, payDay: true, actualDate: true } }),
    ])
    return {
      expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })),
      incomes: incomes.map((i) => ({ ...i, amount: Number(i.amount) })),
    }
  },

  // Sessions of the project (direct or through its goals), for its Time tab.
  sessionsOf: async (userId: string, projectId: string) => {
    return prisma.session.findMany({
      where: { userId, endedAt: { not: null }, OR: [{ projectId }, { goal: { projectId } }] },
      orderBy: { startedAt: 'desc' },
      select: { id: true, projectId: true, goalId: true, startedAt: true, durationMin: true, note: true, goal: { select: { name: true } } },
    })
  },
}

export type ProjectRepository = typeof projectRepository
