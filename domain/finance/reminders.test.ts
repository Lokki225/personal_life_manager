import { describe, expect, it } from 'vitest'

import { dailyReminders, eveningReminders, monthPace } from './reminders'

const today = new Date(2026, 9, 10, 19)
const quiet = { today, hasPlan: true, expensesToday: 2, pendingIncomes: [], debts: [] }
const debt = (direction: 'BORROWED' | 'LENT', dueInDays: number | null, outstanding = 5000) => ({
  direction,
  counterparty: 'Awa',
  outstanding,
  dueDate: dueInDays === null ? null : new Date(2026, 9, 10 + dueInDays, 23, 59, 59),
})

describe('dailyReminders', () => {
  it('has nothing to say on a day that is in order, or before the plan exists', () => {
    expect(dailyReminders(quiet)).toEqual([])
    expect(dailyReminders({ ...quiet, hasPlan: false, expensesToday: 0, pendingIncomes: [{ source: 'Salary' }] })).toEqual([])
  })

  it('asks about spending when nothing was recorded today', () => {
    expect(dailyReminders({ ...quiet, expensesToday: 0 })).toEqual([{ kind: 'recordSpending' }])
  })

  it('asks to confirm each income that is waiting', () => {
    expect(dailyReminders({ ...quiet, pendingIncomes: [{ source: 'Salary' }, { source: 'Rent' }] })).toEqual([
      { kind: 'confirmIncome', source: 'Salary' },
      { kind: 'confirmIncome', source: 'Rent' },
    ])
  })

  it('announces a due date two days ahead, the day before and on the day', () => {
    for (const daysLeft of [2, 1, 0]) {
      expect(dailyReminders({ ...quiet, debts: [debt('BORROWED', daysLeft)] })).toEqual([
        { kind: 'repaymentDue', counterparty: 'Awa', amount: 5000, daysLeft },
      ])
    }
    expect(dailyReminders({ ...quiet, debts: [debt('LENT', 1)] })).toEqual([
      { kind: 'loanDue', counterparty: 'Awa', amount: 5000, daysLeft: 1 },
    ])
    expect(dailyReminders({ ...quiet, debts: [debt('BORROWED', 3)] })).toEqual([])
  })

  it('comes back about a late one the day after, then once a week', () => {
    const late = (daysLate: number) => dailyReminders({ ...quiet, debts: [debt('BORROWED', -daysLate)] })

    expect(late(1)).toEqual([{ kind: 'repaymentLate', counterparty: 'Awa', amount: 5000 }])
    expect(late(2)).toEqual([])
    expect(late(8)).toEqual([{ kind: 'repaymentLate', counterparty: 'Awa', amount: 5000 }])
    expect(dailyReminders({ ...quiet, debts: [debt('LENT', -1)] })).toEqual([
      { kind: 'loanLate', counterparty: 'Awa', amount: 5000 },
    ])
  })

  it('says nothing about a settled debt or one without a due date', () => {
    expect(dailyReminders({ ...quiet, debts: [debt('BORROWED', 0, 0), debt('BORROWED', null)] })).toEqual([])
  })
})

describe('monthPace', () => {
  it('warns at 80% and at 100% of the budget, when the month is less far along', () => {
    // 10 October: a third of the month has passed.
    expect(monthPace(today, 70000, 90000)).toBeNull()
    expect(monthPace(today, 72000, 90000)).toEqual({ threshold: 80, daysLeft: 21, elapsedShare: 32 })
    expect(monthPace(today, 95000, 90000)).toEqual({ threshold: 100, daysLeft: 21, elapsedShare: 32 })
  })

  it('says nothing when spending keeps up with the month, or without a budget', () => {
    const late = new Date(2026, 9, 28, 19)

    expect(monthPace(late, 80000, 90000)).toBeNull()
    expect(monthPace(today, 5000, 0)).toBeNull()
  })
})

describe('eveningReminders', () => {
  it('gives each reminder a key, so it is sent once', () => {
    const reminders = eveningReminders({
      ...quiet,
      expensesToday: 0,
      pendingIncomes: [{ source: 'Salary' }],
      debts: [debt('BORROWED', 0)],
    })

    expect(reminders.map((reminder) => reminder.key)).toEqual([
      'repaymentDue:Awa:2026-10-10',
      'recordSpending:2026-10-10',
      'confirmIncome:Salary:2026-10-10',
    ])
  })

  it('tells about an unexplained overspend, the month pace, the Buffer, goals and chests', () => {
    const reminders = eveningReminders({
      ...quiet,
      overspend: { amount: 1500, explained: false },
      month: { spent: 75000, budget: 90000 },
      sweeps: [{ id: 'move-1', amount: 12000 }],
      goalsReached: [{ id: 'goal-1', name: 'Laptop' }],
      lockedChests: [
        { id: 'trip', name: 'Trip', lockedUntil: new Date(2026, 9, 10, 23, 59, 59) },
        { id: 'house', name: 'House', lockedUntil: new Date(2027, 0, 1) },
      ],
    })

    expect(reminders.map((reminder) => reminder.key)).toEqual([
      'overspend:2026-10-10',
      'pace80:2026-10',
      'goal:goal-1',
      'sweep:move-1',
      'unlock:trip:2026-10-10',
    ])
  })

  it('leaves an explained overspend alone', () => {
    expect(eveningReminders({ ...quiet, overspend: { amount: 1500, explained: true } })).toEqual([])
  })

  it('opens a month with its daily budget', () => {
    const first = new Date(2026, 10, 1, 19)

    expect(eveningReminders({ ...quiet, today: first, dailyBudget: 3000 })).toEqual([
      { kind: 'monthStart', dailyBudget: 3000, key: 'month:2026-11' },
    ])
    expect(eveningReminders({ ...quiet, dailyBudget: 3000 })).toEqual([])
  })

  it('has nothing to say before the plan exists', () => {
    expect(eveningReminders({ ...quiet, hasPlan: false, overspend: { amount: 1500, explained: false } })).toEqual([])
  })
})
