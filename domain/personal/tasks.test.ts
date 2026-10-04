import { describe, expect, it } from 'vitest'

import {
  carryOver,
  dayLoad,
  daysBetween,
  isoWeekday,
  occursOn,
  parseRecurrence,
  statusAfterToggle,
  tasksOfDay,
  type TaskForDay,
} from './tasks'

const day = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h)
const task = (extra: Partial<TaskForDay> = {}): TaskForDay => ({
  id: 't',
  dueDate: null,
  recurrence: null,
  status: 'OPEN',
  createdAt: day(2026, 10, 1, 9),
  ...extra,
})

describe('parseRecurrence', () => {
  it('reads the known kinds and cleans weekly days', () => {
    expect(parseRecurrence({ kind: 'daily' })).toEqual({ kind: 'daily' })
    expect(parseRecurrence({ kind: 'weekly', days: [5, 1, 1, 9, 3] })).toEqual({ kind: 'weekly', days: [1, 3, 5] })
    expect(parseRecurrence({ kind: 'everyN', n: 3 })).toEqual({ kind: 'everyN', n: 3 })
  })

  it('refuses anything else instead of repeating every day', () => {
    expect(parseRecurrence(null)).toBeNull()
    expect(parseRecurrence({ kind: 'weekly', days: [] })).toBeNull()
    expect(parseRecurrence({ kind: 'everyN', n: 0 })).toBeNull()
    expect(parseRecurrence({ kind: 'hourly' })).toBeNull()
  })
})

describe('occursOn', () => {
  it('puts a dated task on its date only, and an undated one nowhere', () => {
    const dated = task({ dueDate: day(2026, 10, 5) })
    expect(occursOn(dated, day(2026, 10, 5, 18))).toBe(true)
    expect(occursOn(dated, day(2026, 10, 6))).toBe(false)
    expect(occursOn(task(), day(2026, 10, 5))).toBe(false)
  })

  it('repeats a daily task from its first day, not before', () => {
    const daily = task({ recurrence: { kind: 'daily' }, dueDate: day(2026, 10, 5) })
    expect(occursOn(daily, day(2026, 10, 4))).toBe(false)
    expect(occursOn(daily, day(2026, 10, 5))).toBe(true)
    expect(occursOn(daily, day(2026, 12, 25))).toBe(true)
  })

  it('starts a recurring task without a date on the day it was created', () => {
    const daily = task({ recurrence: { kind: 'daily' } })
    expect(occursOn(daily, day(2026, 9, 30))).toBe(false)
    expect(occursOn(daily, day(2026, 10, 1))).toBe(true)
  })

  it('repeats a weekly task on its weekdays', () => {
    const mwf = task({ recurrence: { kind: 'weekly', days: [1, 3, 5] } })
    // 5 to 11 October 2026 is Monday to Sunday.
    const week = [5, 6, 7, 8, 9, 10, 11].map((d) => occursOn(mwf, day(2026, 10, d)))
    expect(week).toEqual([true, false, true, false, true, false, false])
    expect(isoWeekday(day(2026, 10, 11))).toBe(7)
  })

  it('repeats every N days across a month boundary', () => {
    const every3 = task({ recurrence: { kind: 'everyN', n: 3 }, dueDate: day(2026, 10, 29) })
    expect([29, 30, 31].map((d) => occursOn(every3, day(2026, 10, d)))).toEqual([true, false, false])
    expect(occursOn(every3, day(2026, 11, 1))).toBe(true)
    expect(occursOn(every3, day(2026, 11, 4))).toBe(true)
  })
})

describe('tasksOfDay', () => {
  it('lists the day’s tasks with whether each is done that day', () => {
    const tasks = [
      task({ id: 'once', dueDate: day(2026, 10, 7) }),
      task({ id: 'daily', recurrence: { kind: 'daily' } }),
      task({ id: 'dropped', dueDate: day(2026, 10, 7), status: 'DROPPED' }),
      task({ id: 'tomorrow', dueDate: day(2026, 10, 8) }),
    ]
    const completions = [
      { taskId: 'daily', occurrenceDate: day(2026, 10, 6) },
      { taskId: 'once', occurrenceDate: day(2026, 10, 7) },
    ]

    expect(tasksOfDay(tasks, completions, day(2026, 10, 7, 15)).map((e) => [e.task.id, e.done])).toEqual([
      ['once', true],
      ['daily', false],
    ])
  })
})

describe('carryOver', () => {
  const today = day(2026, 10, 7, 8)

  it('moves an unfinished task to today, one carry per day it slipped', () => {
    expect(carryOver({ dueDate: day(2026, 10, 6), recurrence: null, status: 'OPEN', carryCount: 0 }, today)).toEqual({
      dueDate: day(2026, 10, 7),
      carryCount: 1,
      status: 'CARRIED_OVER',
    })
    expect(carryOver({ dueDate: day(2026, 10, 4), recurrence: null, status: 'CARRIED_OVER', carryCount: 1 }, today)?.carryCount).toBe(4)
  })

  it('leaves today’s, done, dropped, undated and recurring tasks alone', () => {
    const base = { dueDate: day(2026, 10, 6), recurrence: null, carryCount: 0 }
    expect(carryOver({ ...base, dueDate: day(2026, 10, 7), status: 'OPEN' }, today)).toBeNull()
    expect(carryOver({ ...base, status: 'DONE' }, today)).toBeNull()
    expect(carryOver({ ...base, status: 'DROPPED' }, today)).toBeNull()
    expect(carryOver({ ...base, dueDate: null, status: 'OPEN' }, today)).toBeNull()
    expect(carryOver({ ...base, recurrence: { kind: 'daily' }, status: 'OPEN' }, today)).toBeNull()
  })
})

describe('statusAfterToggle and dayLoad', () => {
  it('reopens a task as carried over when it had slipped before', () => {
    expect(statusAfterToggle(true, 2)).toBe('DONE')
    expect(statusAfterToggle(false, 0)).toBe('OPEN')
    expect(statusAfterToggle(false, 2)).toBe('CARRIED_OVER')
  })

  it('warns above capacity', () => {
    const entries = [{ done: true }, { done: false }, { done: false }]
    expect(dayLoad(entries, 5)).toEqual({ planned: 3, done: 1, capacity: 5, overCapacity: false, progress: 1 / 3 })
    expect(dayLoad(entries, 2).overCapacity).toBe(true)
    expect(dayLoad([], 5).progress).toBe(0)
  })

  it('counts calendar days', () => {
    expect(daysBetween(day(2026, 10, 31, 23), day(2026, 11, 1, 1))).toBe(1)
  })
})
