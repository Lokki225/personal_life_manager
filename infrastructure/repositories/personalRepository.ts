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

  // Every task that is not dropped.
  listTasks: async (userId: string) => {
    return prisma.task.findMany({
      where: { userId, status: { not: 'DROPPED' } },
      include: TASK_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  },

  // The tasks a day can hold: dated that day, or recurring.
  listTasksForDay: async (userId: string, dayStart: Date, dayEnd: Date) => {
    return prisma.task.findMany({
      where: {
        userId,
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

  // Moves each task to its new day, in one transaction.
  carryTasks: async (userId: string, moves: { id: string; dueDate: Date; carryCount: number }[]) => {
    await prisma.$transaction(
      moves.map((move) =>
        prisma.task.updateMany({
          where: { id: move.id, userId },
          data: { dueDate: move.dueDate, carryCount: move.carryCount, status: 'CARRIED_OVER', carryReason: null },
        }),
      ),
    )
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
}

export type PersonalRepository = typeof personalRepository
