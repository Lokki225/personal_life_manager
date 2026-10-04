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
  // Today went over budget and nobody said why yet.
  | { kind: 'overspendUnexplained'; amount: number }
  // The month's budget is being spent faster than the month passes.
  | { kind: 'monthPace'; threshold: PaceThreshold; daysLeft: number; elapsedShare: number }
  // The weekly transfer of the Buffer into the Base Chest happened.
  | { kind: 'bufferSwept'; amount: number }
  // A savings goal's chest reached its target.
  | { kind: 'goalReached'; name: string }
  // The last locked day of a secure chest: its money is free tomorrow.
  | { kind: 'chestUnlocks'; name: string }
  // The first day of a month, with the daily budget it starts with.
  | { kind: 'monthStart'; dailyBudget: number }

export type PaceThreshold = 80 | 100

// A reminder with what identifies it, so it is sent once and only once.
export type KeyedReminder = Reminder & { key: string }

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

// The order of importance, most important first: when only a few may be sent,
// these go first.
const PRIORITY: Reminder['kind'][] = [
  'repaymentLate',
  'repaymentDue',
  'overspendUnexplained',
  'recordSpending',
  'confirmIncome',
  'loanLate',
  'loanDue',
  'monthPace',
  'goalReached',
  'bufferSwept',
  'chestUnlocks',
  'monthStart',
]

const PACE_THRESHOLDS: PaceThreshold[] = [100, 80]

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const sameDay = (left: Date, right: Date) => dayKey(left) === dayKey(right)

// Whether the month's spending is ahead of the month itself: past a share of
// the budget while less of the month than that has passed. Only the highest
// threshold crossed is told.
export function monthPace(today: Date, spent: number, budget: number) {
  if (budget <= 0) {
    return null
  }

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const elapsedShare = (today.getDate() / daysInMonth) * 100
  const spentShare = (spent / budget) * 100
  const threshold = PACE_THRESHOLDS.find((candidate) => spentShare >= candidate && elapsedShare < candidate)

  return threshold
    ? { threshold, daysLeft: daysInMonth - today.getDate(), elapsedShare: Math.round(elapsedShare) }
    : null
}

// Everything worth telling someone at the end of their day, most important
// first, each with the key that keeps it from being sent twice.
export function eveningReminders(
  facts: Parameters<typeof dailyReminders>[0] & {
    // What today looks like against its budget.
    overspend?: { amount: number; explained: boolean }
    // The month's spending against its budget.
    month?: { spent: number; budget: number }
    // Buffer transfers made since the last evening.
    sweeps?: { id: string; amount: number }[]
    // Savings goals whose chest reached its target.
    goalsReached?: { id: string; name: string }[]
    // Secure chests and the end of their lock.
    lockedChests?: { id: string; name: string; lockedUntil: Date }[]
    // The plan's daily budget, for the first day of a month.
    dailyBudget?: number
  },
): KeyedReminder[] {
  if (!facts.hasPlan) {
    return []
  }

  const { today } = facts
  const day = dayKey(today)
  const month = day.slice(0, 7)
  const keyed: KeyedReminder[] = dailyReminders(facts).map((reminder) => {
    switch (reminder.kind) {
      case 'recordSpending':
        return { ...reminder, key: `recordSpending:${day}` }
      case 'confirmIncome':
        return { ...reminder, key: `confirmIncome:${reminder.source}:${day}` }
      default:
        return { ...reminder, key: `${reminder.kind}:${'counterparty' in reminder ? reminder.counterparty : ''}:${day}` }
    }
  })

  if (facts.overspend && facts.overspend.amount >= 1 && !facts.overspend.explained) {
    keyed.push({ kind: 'overspendUnexplained', amount: facts.overspend.amount, key: `overspend:${day}` })
  }

  const pace = facts.month ? monthPace(today, facts.month.spent, facts.month.budget) : null

  if (pace) {
    keyed.push({ kind: 'monthPace', ...pace, key: `pace${pace.threshold}:${month}` })
  }

  for (const sweep of facts.sweeps ?? []) {
    keyed.push({ kind: 'bufferSwept', amount: sweep.amount, key: `sweep:${sweep.id}` })
  }

  for (const goal of facts.goalsReached ?? []) {
    keyed.push({ kind: 'goalReached', name: goal.name, key: `goal:${goal.id}` })
  }

  for (const chest of facts.lockedChests ?? []) {
    if (sameDay(chest.lockedUntil, today)) {
      keyed.push({ kind: 'chestUnlocks', name: chest.name, key: `unlock:${chest.id}:${day}` })
    }
  }

  if (today.getDate() === 1 && (facts.dailyBudget ?? 0) >= 1) {
    keyed.push({ kind: 'monthStart', dailyBudget: facts.dailyBudget!, key: `month:${month}` })
  }

  return keyed.sort((left, right) => PRIORITY.indexOf(left.kind) - PRIORITY.indexOf(right.kind))
}
