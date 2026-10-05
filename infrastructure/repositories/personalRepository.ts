import { Prisma } from '../../app/generated/prisma/client'
import { currentOrigin } from '../../lib/origin'
import { prisma } from '../prisma/client'

// Personal node: categories, tasks and their completions. Every write checks
// the task belongs to the user, so a guessed id changes nothing.

const TASK_INCLUDE = { category: { select: { id: true, name: true } } } as const

export type TaskRecord = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>
export type CategoryRecord = Prisma.CategoryGetPayload<object>

export type CreateTaskData = {
  title: string
  dueDate: Date | null
  recurrence: Prisma.InputJsonValue | null
  categoryId: string | null
  goalId?: string | null
  milestoneId?: string | null
}

export type UpdateTaskData = Partial<{
  title: string
  dueDate: Date | null
  recurrence: Prisma.InputJsonValue | null
  categoryId: string | null
  status: 'OPEN' | 'DONE' | 'CARRIED_OVER' | 'DROPPED'
  carryCount: number
  carryReason: string | null
}>

// No recurrence is stored as a database NULL.
const jsonOrNull = (value: Prisma.InputJsonValue | null) => (value === null ? Prisma.DbNull : value)

export const personalRepository = {
  getTaskSettings: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { dailyTaskCapacity: true, tasksSettledThrough: true },
    })
  },

  setDailyTaskCapacity: async (userId: string, capacity: number) => {
    await prisma.user.updateMany({ where: { id: userId }, data: { dailyTaskCapacity: capacity } })
  },

  // Marks the days up to `through` as carried over. False when another
  // request did it in the meantime.
  claimTasksSettlement: async (userId: string, previous: Date | null, through: Date) => {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, tasksSettledThrough: previous },
      data: { tasksSettledThrough: through },
    })

    return count > 0
  },

  listCategories: async (userId: string) => {
    return prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  },

  createCategories: async (userId: string, names: string[]) => {
    await prisma.category.createMany({ data: names.map((name) => ({ userId, name })), skipDuplicates: true })
  },

  // Every Personal task that is not dropped.
  listTasks: async (userId: string) => {
    return prisma.task.findMany({
      where: { userId, domain: 'personal', status: { not: 'DROPPED' } },
      include: TASK_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  },

  // The tasks a day can hold: dated that day, or recurring.
  listTasksForDay: async (userId: string, dayStart: Date, dayEnd: Date) => {
    return prisma.task.findMany({
      where: {
        userId,
        domain: 'personal',
        status: { not: 'DROPPED' },
        OR: [{ dueDate: { gte: dayStart, lt: dayEnd } }, { recurrence: { not: Prisma.DbNull } }],
      },
      include: TASK_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  },

  // One-off tasks still open from a day before `before`.
  listUnfinishedBefore: async (userId: string, before: Date) => {
    return prisma.task.findMany({
      where: {
        userId,
        domain: 'personal',
        status: { in: ['OPEN', 'CARRIED_OVER'] },
        dueDate: { lt: before },
        recurrence: { equals: Prisma.DbNull },
      },
    })
  },

  listCompletions: async (userId: string, from: Date, to: Date) => {
    return prisma.taskCompletion.findMany({
      where: { task: { userId }, occurrenceDate: { gte: from, lt: to } },
      select: { taskId: true, occurrenceDate: true },
    })
  },

  getTask: async (userId: string, id: string) => {
    return prisma.task.findFirst({ where: { id, userId }, include: TASK_INCLUDE })
  },

  createTask: async (userId: string, data: CreateTaskData) => {
    return prisma.task.create({
      data: {
        userId,
        origin: currentOrigin(),
        title: data.title,
        dueDate: data.dueDate,
        recurrence: jsonOrNull(data.recurrence),
        categoryId: data.categoryId,
        goalId: data.goalId ?? null,
        milestoneId: data.milestoneId ?? null,
      },
      include: TASK_INCLUDE,
    })
  },

  updateTask: async (userId: string, id: string, data: UpdateTaskData) => {
    const { recurrence, ...rest } = data
    const { count } = await prisma.task.updateMany({
      where: { id, userId },
      data: { ...rest, ...(recurrence === undefined ? {} : { recurrence: jsonOrNull(recurrence) }) },
    })

    return count > 0
  },

  // Moves each task to its new day and notes the slip, in one transaction.
  carryTasks: async (userId: string, moves: { id: string; dueDate: Date; carryCount: number; days: number }[]) => {
    await prisma.$transaction([
      ...moves.map((move) =>
        prisma.task.updateMany({
          where: { id: move.id, userId },
          data: { dueDate: move.dueDate, carryCount: move.carryCount, status: 'CARRIED_OVER', carryReason: null },
        }),
      ),
      prisma.taskCarry.createMany({ data: moves.map((move) => ({ taskId: move.id, carriedTo: move.dueDate, days: move.days })) }),
    ])
  },

  // Gives the latest slip of a task its reason.
  setLatestCarryReason: async (userId: string, taskId: string, reason: string) => {
    const latest = await prisma.taskCarry.findFirst({
      where: { taskId, task: { userId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (latest) await prisma.taskCarry.update({ where: { id: latest.id }, data: { reason } })
  },

  // The slips of a period, with their tasks.
  listCarries: async (userId: string, from: Date, to: Date) => {
    return prisma.taskCarry.findMany({
      where: { task: { userId }, carriedTo: { gte: from, lt: to } },
      select: { taskId: true, carriedTo: true, days: true, reason: true, task: { select: { title: true } } },
    })
  },

  // Ticks or unticks one day of a task, and sets the task's status with it.
  setCompletion: async (
    userId: string,
    taskId: string,
    occurrenceDate: Date,
    done: boolean,
    status: 'OPEN' | 'DONE' | 'CARRIED_OVER' | null,
  ) => {
    await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, userId }, select: { id: true } })

      if (!task) {
        return
      }

      if (done) {
        await tx.taskCompletion.upsert({
          where: { taskId_occurrenceDate: { taskId, occurrenceDate } },
          create: { taskId, occurrenceDate },
          update: {},
        })
      } else {
        await tx.taskCompletion.deleteMany({ where: { taskId, occurrenceDate } })
      }

      if (status) {
        await tx.task.update({ where: { id: taskId }, data: { status } })
      }
    })
  },

  deleteTask: async (userId: string, id: string) => {
    const { count } = await prisma.task.deleteMany({ where: { id, userId } })
    return count > 0
  },

  // --- Sessions ---------------------------------------------------------------

  getRunningSession: async (userId: string) => {
    return prisma.session.findFirst({
      where: { userId, endedAt: null },
      include: { goal: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    })
  },

  createSession: async (
    userId: string,
    data: { goalId: string | null; startedAt: Date; endedAt: Date | null; durationMin: number | null; note: string | null },
  ) => {
    return prisma.session.create({ data: { userId, origin: currentOrigin(), ...data }, select: { id: true } })
  },

  finishSession: async (userId: string, id: string, endedAt: Date, durationMin: number, note: string | null) => {
    const { count } = await prisma.session.updateMany({
      where: { id, userId, endedAt: null },
      data: { endedAt, durationMin, ...(note ? { note } : {}) },
    })
    return count > 0
  },

  deleteSession: async (userId: string, id: string) => {
    const { count } = await prisma.session.deleteMany({ where: { id, userId } })
    return count > 0
  },

  listSessions: async (userId: string, from: Date, to: Date) => {
    return prisma.session.findMany({
      where: { userId, startedAt: { gte: from, lt: to }, endedAt: { not: null } },
      include: { goal: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    })
  },

  // --- Metric series ----------------------------------------------------------

  listSeries: async (userId: string) => {
    return prisma.metricSeries.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  },

  createSeries: async (userId: string, data: { key: string; label: string; unit: string | null }) => {
    return prisma.metricSeries.create({ data: { userId, ...data } })
  },

  addEntry: async (userId: string, seriesId: string, value: number, recordedAt: Date) => {
    const series = await prisma.metricSeries.findFirst({ where: { id: seriesId, userId }, select: { id: true } })
    if (!series) return false
    await prisma.metricEntry.create({ data: { seriesId, value, recordedAt } })
    return true
  },

  listEntries: async (userId: string, seriesId: string) => {
    return prisma.metricEntry.findMany({
      where: { seriesId, series: { userId } },
      orderBy: { recordedAt: 'asc' },
      select: { id: true, value: true, recordedAt: true, source: true },
    })
  },
}

// Everything a person recorded in Personal, for their data export. Journal
// password hashes stay out; locked entries come with their text, since the
// export is the person's own copy.
export async function exportPersonal(userId: string) {
  const [categories, tasks, goals, sessions, measures, journal] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.task.findMany({ where: { userId }, include: { completions: true, carries: true } }),
    prisma.goal.findMany({
      where: { userId, domain: { not: 'finance' } },
      include: { groups: { include: { conditions: true } }, milestones: true },
    }),
    prisma.session.findMany({ where: { userId } }),
    prisma.metricSeries.findMany({ where: { userId }, include: { entries: true } }),
    prisma.journalEntry.findMany({ where: { userId }, omit: { passwordHash: true }, include: { links: true } }),
  ])

  return { categories, tasks, goals, sessions, measures, journal }
}

export type PersonalRepository = typeof personalRepository
