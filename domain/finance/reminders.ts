// What is worth telling someone about at the end of a day. Pure rules: the
// caller gathers the facts and decides how to word and send each reminder.

export type Reminder =
  | { kind: 'recordSpending' }
  | { kind: 'confirmIncome'; source: string }
  // Money the person owes, coming due. `daysLeft` is 0 today, 1 tomorrow...
  | { kind: 'repaymentDue'; counterparty: string; amount: number; daysLeft: number }
  | { kind: 'repaymentLate'; counterparty: string; amount: number }
  // Money owed to the person, coming due.
  | { kind: 'loanDue'; counterparty: string; amount: number; daysLeft: number }
  | { kind: 'loanLate'; counterparty: string; amount: number }

// A due date is announced two days ahead, the day before and on the day.
const DAYS_AHEAD = 2
// Once late, it comes back the day after and then once a week, not every day.
const isLateReminderDay = (daysLate: number) => daysLate % 7 === 1

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Whole days from `from` to `to`, by the calendar.
const daysBetween = (from: Date, to: Date) =>
  Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / (24 * 60 * 60 * 1000))

export function dailyReminders({
  today,
  hasPlan,
  expensesToday,
  pendingIncomes,
  debts,
}: {
  today: Date
  // Whether the finance setup was done. Without it there is nothing to remind.
  hasPlan: boolean
  // How many expenses were recorded today.
  expensesToday: number
  // The incomes waiting to be confirmed.
  pendingIncomes: { source: string }[]
  debts: { direction: 'BORROWED' | 'LENT'; counterparty: string; outstanding: number; dueDate: Date | null }[]
}): Reminder[] {
  if (!hasPlan) {
    return []
  }

  const reminders: Reminder[] = []

  if (expensesToday === 0) {
    reminders.push({ kind: 'recordSpending' })
  }

  for (const income of pendingIncomes) {
    reminders.push({ kind: 'confirmIncome', source: income.source })
  }

  for (const debt of debts) {
    if (debt.outstanding <= 0 || !debt.dueDate) {
      continue
    }

    const daysLeft = daysBetween(today, debt.dueDate)
    const borrowed = debt.direction === 'BORROWED'
    const facts = { counterparty: debt.counterparty, amount: debt.outstanding }

    if (daysLeft >= 0 && daysLeft <= DAYS_AHEAD) {
      reminders.push({ kind: borrowed ? 'repaymentDue' : 'loanDue', ...facts, daysLeft })
    } else if (daysLeft < 0 && isLateReminderDay(-daysLeft)) {
      reminders.push({ kind: borrowed ? 'repaymentLate' : 'loanLate', ...facts })
    }
  }

  return reminders
}
