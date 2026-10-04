import { describe, expect, it, vi } from 'vitest'

import type { PersonalRepository } from '@/infrastructure/repositories/personalRepository'

import { addTask, carryOverTasks, getTodayTasks, scheduleTask, setCarryReason, setDailyCapacity, setTaskDone } from './tasks'

const day = (d: number, h = 0) => new Date(2026, 9, d, h)

type Row = {
  id: string
  userId: string
  title: string
  dueDate: Date | null
  recurrence: unknown
  status: 'OPEN' | 'DONE' | 'CARRIED_OVER' | 'DROPPED'
  carryCount: number
  carryReason: string | null
  createdAt: Date
  category: null
}

// An in-memory stand-in for the repository, enough for these rules.
function fakeRepository(rows: Partial<Row>[], settledThrough: Date | null = null) {
  const tasks: Row[] = rows.map((row, i) => ({
    id: `t${i}`,
    userId: 'u',
    title: `Task ${i}`,
    dueDate: null,
    recurrence: null,
    status: 'OPEN',
    carryCount: 0,
    carryReason: null,
    createdAt: day(1, 9),
    category: null,
    ...row,
  }))
  const completions: { taskId: string; occurrenceDate: Date }[] = []
  let tasksSettledThrough = settledThrough

  const repo = {
    getTaskSettings: async () => ({ dailyTaskCapacity: 2, tasksSettledThrough }),
    setDailyTaskCapacity: vi.fn(async () => {}),
    claimTasksSettlement: vi.fn(async (_u: string, previous: Date | null, through: Date) => {
      if (previous?.getTime() !== tasksSettledThrough?.getTime()) return false
      tasksSettledThrough = through
      return true
    }),
    listCategories: async () => [{ id: 'cat', name: 'Mind' }],
    createCategories: async () => {},
    listTasks: async () => tasks.filter((t) => t.status !== 'DROPPED'),
    listTasksForDay: async (_u: string, from: Date, to: Date) =>
      tasks.filter((t) => t.status !== 'DROPPED' && (t.recurrence || (t.dueDate && t.dueDate >= from && t.dueDate < to))),
    listUnfinishedBefore: async (_u: string, before: Date) =>
      tasks.filter((t) => ['OPEN', 'CARRIED_OVER'].includes(t.status) && !t.recurrence && t.dueDate && t.dueDate < before),
    listCompletions: async () => completions,
    getTask: async (_u: string, id: string) => tasks.find((t) => t.id === id) ?? null,
    createTask: vi.fn(async (_u: string, data: object) => ({ id: 'new', ...data })),
    updateTask: vi.fn(async (_u: string, id: string, data: Partial<Row>) => {
      Object.assign(tasks.find((t) => t.id === id)!, data)
      return true
    }),
    carryTasks: vi.fn(async (_u: string, moves: { id: string; dueDate: Date; carryCount: number }[]) => {
      for (const move of moves) Object.assign(tasks.find((t) => t.id === move.id)!, { ...move, status: 'CARRIED_OVER' })
    }),
    setCompletion: vi.fn(async (_u: string, taskId: string, occurrenceDate: Date, done: boolean, status: Row['status'] | null) => {
      if (done) completions.push({ taskId, occurrenceDate })
      if (status) tasks.find((t) => t.id === taskId)!.status = status
    }),
    deleteTask: async () => true,
  }

  return { repo: repo as unknown as PersonalRepository & typeof repo, tasks }
}

describe('carryOverTasks', () => {
  it('moves yesterday’s unfinished tasks to today, once', async () => {
    const { repo, tasks } = fakeRepository([{ dueDate: day(5) }, { dueDate: day(6), status: 'DONE' }, { dueDate: day(7) }])

    await carryOverTasks('u', day(7, 8), repo)
    await carryOverTasks('u', day(7, 20), repo)

    expect(tasks[0]).toMatchObject({ dueDate: day(7), carryCount: 2, status: 'CARRIED_OVER' })
    expect(tasks[1].status).toBe('DONE')
    expect(tasks[2]).toMatchObject({ dueDate: day(7), carryCount: 0, status: 'OPEN' })
    expect(repo.carryTasks).toHaveBeenCalledTimes(1)
  })

  it('does nothing when another request already claimed the day', async () => {
    const { repo } = fakeRepository([{ dueDate: day(5) }], day(6))
    await carryOverTasks('u', day(7, 8), repo)
    expect(repo.claimTasksSettlement).not.toHaveBeenCalled()
  })
})

describe('getTodayTasks', () => {
  it('lists today’s tasks, warns over capacity, and asks why carried ones slipped', async () => {
    const { repo } = fakeRepository([
      { dueDate: day(6) },
      { recurrence: { kind: 'daily' } },
      { dueDate: day(7) },
      { dueDate: day(8) },
    ])

    const today = await getTodayTasks('u', day(7, 9), repo)

    expect(today.entries.map((e) => e.task.id)).toEqual(['t0', 't1', 't2'])
    expect(today.load).toMatchObject({ planned: 3, done: 0, capacity: 2, overCapacity: true })
    expect(today.awaitingReason.map((t) => t.id)).toEqual(['t0'])
  })
})

describe('setTaskDone', () => {
  it('marks a one-off task done on its day, and a recurring one only for today', async () => {
    const { repo, tasks } = fakeRepository([{ dueDate: day(7) }, { recurrence: { kind: 'daily' } }])

    await setTaskDone('u', 't0', true, day(7, 10), repo)
    await setTaskDone('u', 't1', true, day(7, 10), repo)

    expect(tasks[0].status).toBe('DONE')
    expect(repo.setCompletion).toHaveBeenNthCalledWith(2, 'u', 't1', day(7), true, null)
    expect(tasks[1].status).toBe('OPEN')
  })

  it('refuses a task that is not the user’s', async () => {
    const { repo } = fakeRepository([])
    await expect(setTaskDone('u', 'nope', true, day(7), repo)).rejects.toThrow('This task no longer exists.')
  })
})

describe('setCarryReason', () => {
  it('keeps the reason, and drops the task when it is no longer relevant', async () => {
    const { repo, tasks } = fakeRepository([{ status: 'CARRIED_OVER' }, { status: 'CARRIED_OVER' }])

    await setCarryReason('u', 't0', 'no_time', repo)
    await setCarryReason('u', 't1', 'not_relevant', repo)
    await setCarryReason('u', 't0', 'Waiting on a call back', repo)

    expect(tasks[0]).toMatchObject({ carryReason: 'Waiting on a call back', status: 'CARRIED_OVER' })
    expect(tasks[1]).toMatchObject({ carryReason: 'not_relevant', status: 'DROPPED' })
    await expect(setCarryReason('u', 't0', '  ', repo)).rejects.toMatchObject({ field: 'reason' })
  })
})

describe('addTask, scheduleTask and capacity', () => {
  it('checks the title and category, and dates a task at midnight', async () => {
    const { repo } = fakeRepository([])

    await addTask('u', { title: '  Call home ', dueDate: day(7, 15), recurrence: null, categoryId: 'cat' }, repo)
    expect(repo.createTask).toHaveBeenCalledWith('u', { title: 'Call home', dueDate: day(7), recurrence: null, categoryId: 'cat' })

    await expect(addTask('u', { title: ' ', dueDate: null, recurrence: null, categoryId: null }, repo)).rejects.toMatchObject({ field: 'title' })
    await expect(
      addTask('u', { title: 'x', dueDate: null, recurrence: null, categoryId: 'someone-else' }, repo),
    ).rejects.toMatchObject({ field: 'categoryId' })
  })

  it('schedules an inbox task, but not a repeating one', async () => {
    const { repo, tasks } = fakeRepository([{}, { recurrence: { kind: 'daily' } }])

    await scheduleTask('u', 't0', day(9, 14), repo)
    expect(tasks[0]).toMatchObject({ dueDate: day(9), status: 'OPEN' })
    await expect(scheduleTask('u', 't1', day(9), repo)).rejects.toThrow('A repeating task already has its days.')
  })

  it('keeps the capacity between 1 and 30', async () => {
    const { repo } = fakeRepository([])
    await setDailyCapacity('u', 6, repo)
    expect(repo.setDailyTaskCapacity).toHaveBeenCalledWith('u', 6)
    await expect(setDailyCapacity('u', 0, repo)).rejects.toMatchObject({ field: 'capacity' })
  })
})
