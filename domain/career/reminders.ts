import { daysBetween, mondayOf } from './week'

// Career reminders (Career spec §13), worked out on the person's clock in the
// daily run. Each has a key so it is sent once.

export type CareerReminder =
  | { kind: 'opportunityDeadline'; key: string; title: string; daysLeft: 1 | 2; opportunityId: string }
  | { kind: 'weeklyReview'; key: string; openFocus: number }
  | { kind: 'reviewDue'; key: string; count: number }

export type CareerReminderFacts = {
  today: Date
  // Open opportunities with a deadline.
  opportunities: { id: string; title: string; deadline: Date | null }[]
  // Focus items of this week not done yet.
  openFocus: number
  // 1 is Monday, 7 is Sunday.
  reviewDay: number
  // Facts and judgements due for a fresh look.
  dueForReview: number
}

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function careerReminders({ today, opportunities, openFocus, reviewDay, dueForReview }: CareerReminderFacts): CareerReminder[] {
  const reminders: CareerReminder[] = []

  // A deadline in 2 days, then tomorrow: sooner first.
  const due = opportunities
    .flatMap((o) => {
      if (!o.deadline) return []
      const daysLeft = daysBetween(today, o.deadline)
      return daysLeft === 1 || daysLeft === 2 ? [{ ...o, daysLeft: daysLeft as 1 | 2 }] : []
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
  for (const o of due) {
    reminders.push({ kind: 'opportunityDeadline', key: `career:deadline:${o.id}:${o.daysLeft}`, title: o.title, daysLeft: o.daysLeft, opportunityId: o.id })
  }

  // On the review day, only when there is something left to look at.
  if ((today.getDay() || 7) === reviewDay && openFocus > 0) {
    reminders.push({ kind: 'weeklyReview', key: `career:review:${iso(mondayOf(today))}`, openFocus })
  }

  // At most once a month.
  if (dueForReview > 0) {
    reminders.push({ kind: 'reviewDue', key: `career:reviewDue:${today.getFullYear()}-${today.getMonth() + 1}`, count: dueForReview })
  }

  return reminders
}
