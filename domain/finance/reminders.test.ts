import { describe, expect, it } from 'vitest'

import { dailyReminders } from './reminders'

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
