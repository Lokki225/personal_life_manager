import { PersonalRuleError } from '../../domain/personal/errors'
import {
  addDays,
  carryOver,
  CARRY_REASONS,
  dayLoad,
  DEFAULT_CATEGORIES,
  parseRecurrence,
  startOfDay,
  statusAfterToggle,
  STILL_RELEVANT_AFTER,
  tasksOfDay,
  type Recurrence,
} from '../../domain/personal/tasks'
import { personalRepository, type TaskRecord } from '../../infrastructure/repositories/personalRepository'
import { now as clockNow } from '../../lib/clock'
import { withOrigin } from '../../lib/origin'

type Deps = typeof personalRepository

const withRecurrence = (task: TaskRecord) => ({ ...task, recurrence: parseRecurrence(task.recurrence) })

export type PersonalTask = ReturnType<typeof withRecurrence>

// The day's tasks, ticked or not, and how full the day is. Unfinished tasks
// of past days are moved to today first.
export async function getTodayTasks(userId: string, now: Date = clockNow(), deps: Deps = personalRepository) {
  await carryOverTasks(userId, now, deps)

  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const [settings, tasks, completions] = await Promise.all([
    deps.getTaskSettings(userId),
    deps.listTasksForDay(userId, today, tomorrow),
    deps.listCompletions(userId, today, tomorrow),
  ])
  const entries = tasksOfDay(tasks.map(withRecurrence), completions, today)

  return {
    entries,
    load: dayLoad(entries, settings?.dailyTaskCapacity ?? 5),
    // Tasks moved to today that still have no reason for slipping.
    awaitingReason: entries.filter((e) => !e.done && e.task.status === 'CARRIED_OVER' && !e.task.carryReason).map((e) => e.task),
  }
}

// Moves the unfinished one-off tasks of the days that ended to today. Runs
// once a day, the first time Personal is opened (like Finance's settlement).
export async function carryOverTasks(userId: string, now: Date = clockNow(), deps: Deps = personalRepository) {
  const today = startOfDay(now)
  const yesterday = addDays(today, -1)
  const settings = await deps.getTaskSettings(userId)
  const previous = settings?.tasksSettledThrough ?? null

  if (previous && startOfDay(previous) >= yesterday) {
    return
  }

  // Claiming first means two requests at once cannot both move the tasks.
  if (!(await deps.claimTasksSettlement(userId, previous, yesterday))) {
    return
  }

  const unfinished = await deps.listUnfinishedBefore(userId, today)
  const moves = unfinished.flatMap((task) => {
    const move = carryOver({ ...task, recurrence: parseRecurrence(task.recurrence) }, today)
    return move ? [{ id: task.id, dueDate: move.dueDate, carryCount: move.carryCount, days: move.carryCount - task.carryCount }] : []
  })

  if (moves.length > 0) {
    // Moving tasks is the app's doing, even in a request from the assistant.
    await withOrigin(null, () => deps.carryTasks(userId, moves))
  }
}

export type NewTask = {
  title: string
  // 'today' | 'tomorrow' | a date | null for the inbox.
  dueDate: Date | null
  recurrence: Recurrence | null
  categoryId: string | null
  // Set by the goal pages, after checking the goal is the user's.
  goalId?: string | null
  milestoneId?: string | null
}

async function checkCategory(userId: string, categoryId: string | null, deps: Deps) {
  if (categoryId && !(await deps.listCategories(userId)).some((category) => category.id === categoryId)) {
    throw new PersonalRuleError('Choose one of your categories.', 'categoryId')
  }
}

export async function addTask(userId: string, input: NewTask, deps: Deps = personalRepository) {
  const title = input.title.trim()

  if (!title) {
    throw new PersonalRuleError('Enter a task.', 'title')
  }
  if (title.length > 120) {
    throw new PersonalRuleError('Keep it under 120 characters.', 'title')
  }

  await checkCategory(userId, input.categoryId, deps)

  return deps.createTask(userId, {
    title,
    dueDate: input.dueDate ? startOfDay(input.dueDate) : null,
    recurrence: input.recurrence,
    categoryId: input.categoryId,
    goalId: input.goalId ?? null,
    milestoneId: input.milestoneId ?? null,
  })
}

async function ownTask(userId: string, taskId: string, deps: Deps) {
  const task = await deps.getTask(userId, taskId)

  if (!task) {
    throw new PersonalRuleError('This task no longer exists.')
  }

  return withRecurrence(task)
}

// Ticks or unticks a task for a day. A one-off task becomes done (or open
// again); a recurring one only records that day.
export async function setTaskDone(
  userId: string,
  taskId: string,
  done: boolean,
  now: Date = clockNow(),
  deps: Deps = personalRepository,
) {
  const task = await ownTask(userId, taskId, deps)
  const day = task.recurrence || !task.dueDate ? startOfDay(now) : startOfDay(task.dueDate)
  const status = task.recurrence ? null : statusAfterToggle(done, task.carryCount)

  await deps.setCompletion(userId, taskId, day, done, status)
}

export async function setCarryReason(userId: string, taskId: string, reason: string, deps: Deps = personalRepository) {
  const known = CARRY_REASONS.find((candidate) => candidate === reason)
  const text = reason.trim()

  if (!text) {
    throw new PersonalRuleError('Choose a reason.', 'reason')
  }
  if (text.length > 80) {
    throw new PersonalRuleError('Keep it under 80 characters.', 'reason')
  }

  await ownTask(userId, taskId, deps)

  // Not relevant any more: the task goes, instead of slipping again.
  await deps.updateTask(userId, taskId, known === 'not_relevant' ? { status: 'DROPPED', carryReason: known } : { carryReason: known ?? text })
  await deps.setLatestCarryReason(userId, taskId, known ?? text)
}

// Gives an inbox task (or any task) a day, or sends it back to the inbox.
export async function scheduleTask(userId: string, taskId: string, dueDate: Date | null, deps: Deps = personalRepository) {
  const task = await ownTask(userId, taskId, deps)

  if (task.recurrence) {
    throw new PersonalRuleError('A repeating task already has its days.')
  }

  await deps.updateTask(userId, taskId, {
    dueDate: dueDate ? startOfDay(dueDate) : null,
    status: task.status === 'DONE' ? 'DONE' : 'OPEN',
  })
}

export async function dropTask(userId: string, taskId: string, deps: Deps = personalRepository) {
  await ownTask(userId, taskId, deps)
  await deps.updateTask(userId, taskId, { status: 'DROPPED' })
}

export async function deleteTask(userId: string, taskId: string, deps: Deps = personalRepository) {
  if (!(await deps.deleteTask(userId, taskId))) {
    throw new PersonalRuleError('This task no longer exists.')
  }
}

export async function setDailyCapacity(userId: string, capacity: number, deps: Deps = personalRepository) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
    throw new PersonalRuleError('Choose between 1 and 30 tasks.', 'capacity')
  }

  await deps.setDailyTaskCapacity(userId, capacity)
}

// Every task, sorted into what the Tasks page shows.
export async function getTaskLists(userId: string, now: Date = clockNow(), deps: Deps = personalRepository) {
  await carryOverTasks(userId, now, deps)

  const today = startOfDay(now)
  const tasks = (await deps.listTasks(userId)).map(withRecurrence)
  const open = tasks.filter((t) => t.status !== 'DONE')

  return {
    inbox: open.filter((t) => !t.dueDate && !t.recurrence),
    upcoming: open
      .filter((t) => !t.recurrence && t.dueDate && t.dueDate >= today)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()),
    repeating: tasks.filter((t) => t.recurrence),
    carried: open.filter((t) => t.status === 'CARRIED_OVER').sort((a, b) => b.carryCount - a.carryCount),
    stillRelevant: open.filter((t) => t.carryCount >= STILL_RELEVANT_AFTER),
  }
}

// The suggested categories, created the first time Personal opens.
export async function ensureDefaultCategories(userId: string, deps: Deps = personalRepository) {
  const categories = await deps.listCategories(userId)

  if (categories.length > 0) {
    return categories
  }

  await deps.createCategories(userId, [...DEFAULT_CATEGORIES])
  return deps.listCategories(userId)
}
