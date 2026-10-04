// Personal tasks: which ones a day holds, and what happens to the unfinished
// ones when the day ends. Pure functions; dates are on the person's clock.

export type Recurrence = { kind: 'daily' } | { kind: 'weekly'; days: number[] } | { kind: 'everyN'; n: number }

export type TaskStatus = 'OPEN' | 'DONE' | 'CARRIED_OVER' | 'DROPPED'

export type TaskForDay = {
  id: string
  dueDate: Date | null
  recurrence: Recurrence | null
  status: TaskStatus
  createdAt: Date
}

// Why a task slipped to the next day. "Not relevant" drops it instead.
export const CARRY_REASONS = ['no_time', 'low_energy', 'blocked', 'not_relevant'] as const
export type CarryReason = (typeof CARRY_REASONS)[number]

// A task carried over this many times is worth asking about.
export const STILL_RELEVANT_AFTER = 3

export const DEFAULT_CATEGORIES = ['Mind', 'Body', 'Skills', 'Leisure', 'Relationships', 'Home'] as const

const DAY_MS = 86_400_000

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()

// Whole days from `from` to `to`, counted on the calendar (a 23-hour day
// still counts as one).
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS)

// 1 is Monday, 7 is Sunday.
export const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1

// Reads a recurrence stored as JSON, or null when there is none (or it is not
// one we know, so a bad value never makes a task appear every day).
export function parseRecurrence(value: unknown): Recurrence | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const r = value as { kind?: unknown; days?: unknown; n?: unknown }

  if (r.kind === 'daily') {
    return { kind: 'daily' }
  }
  if (r.kind === 'weekly' && Array.isArray(r.days)) {
    const days = [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b)
    return days.length > 0 ? { kind: 'weekly', days } : null
  }
  if (r.kind === 'everyN' && Number.isInteger(r.n) && (r.n as number) >= 1) {
    return { kind: 'everyN', n: r.n as number }
  }

  return null
}

// Whether a task belongs to a day: a dated task on its date, a recurring one
// on each of its occurrences from its first day on.
export function occursOn(task: Pick<TaskForDay, 'dueDate' | 'recurrence' | 'createdAt'>, day: Date): boolean {
  if (!task.recurrence) {
    return task.dueDate !== null && sameDay(task.dueDate, day)
  }

  const first = startOfDay(task.dueDate ?? task.createdAt)
  const offset = daysBetween(first, day)

  if (offset < 0) {
    return false
  }

  switch (task.recurrence.kind) {
    case 'daily':
      return true
    case 'weekly':
      return task.recurrence.days.includes(isoWeekday(day))
    case 'everyN':
      return offset % task.recurrence.n === 0
  }
}

// The tasks of a day, each with whether it is done that day. Dropped tasks
// are gone; a one-off task done on its day stays, ticked.
export function tasksOfDay<T extends TaskForDay>(
  tasks: T[],
  completions: { taskId: string; occurrenceDate: Date }[],
  day: Date,
): { task: T; done: boolean }[] {
  const doneToday = new Set(completions.filter((c) => sameDay(c.occurrenceDate, day)).map((c) => c.taskId))

  return tasks
    .filter((task) => task.status !== 'DROPPED' && occursOn(task, day))
    .map((task) => ({ task, done: doneToday.has(task.id) }))
}

// Where an unfinished one-off task goes when its day has ended: to `today`,
// one more carry for each day it slipped. Recurring tasks do not stack: a
// missed occurrence stays missed. Null when there is nothing to move.
export function carryOver(
  task: Pick<TaskForDay, 'dueDate' | 'recurrence' | 'status'> & { carryCount: number },
  today: Date,
): { dueDate: Date; carryCount: number; status: 'CARRIED_OVER' } | null {
  if (task.recurrence || !task.dueDate || (task.status !== 'OPEN' && task.status !== 'CARRIED_OVER')) {
    return null
  }

  const slipped = daysBetween(task.dueDate, today)

  if (slipped <= 0) {
    return null
  }

  return { dueDate: startOfDay(today), carryCount: task.carryCount + slipped, status: 'CARRIED_OVER' }
}

// The status a one-off task takes when it is ticked or unticked.
export function statusAfterToggle(done: boolean, carryCount: number): Exclude<TaskStatus, 'DROPPED'> {
  if (done) return 'DONE'
  return carryCount > 0 ? 'CARRIED_OVER' : 'OPEN'
}

// How full a day is. Above capacity is a warning, never a block.
export function dayLoad(entries: { done: boolean }[], capacity: number) {
  const planned = entries.length
  const done = entries.filter((e) => e.done).length

  return { planned, done, capacity, overCapacity: planned > capacity, progress: planned === 0 ? 0 : done / planned }
}
