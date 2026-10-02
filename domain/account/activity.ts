// How people use the app, for the administration dashboard. Everything here
// is counts and dates: never an amount, never what someone wrote.

const DAY = 24 * 60 * 60 * 1000

export type ActivityStatus = 'active' | 'quiet' | 'gone' | 'never'

// Active within the last week, quiet up to a month, gone after that.
export function activityStatus(lastActiveAt: Date | null, now: Date): ActivityStatus {
  if (!lastActiveAt) {
    return 'never'
  }

  const days = (now.getTime() - lastActiveAt.getTime()) / DAY

  return days <= 7 ? 'active' : days <= 30 ? 'quiet' : 'gone'
}

export function latestOf(...dates: (Date | null | undefined)[]): Date | null {
  return dates.reduce<Date | null>((latest, date) => (date && (!latest || date > latest) ? date : latest), null)
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

// For each of the last `days` days, today included: how many different
// people recorded something.
export function activeUsersPerDay(
  events: { userId: string; at: Date }[],
  now: Date,
  days: number,
): { day: Date; users: number }[] {
  const usersByDay = new Map<string, Set<string>>()

  for (const event of events) {
    const key = dayKey(event.at)
    usersByDay.set(key, (usersByDay.get(key) ?? new Set()).add(event.userId))
  }

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index))

    return { day, users: usersByDay.get(dayKey(day))?.size ?? 0 }
  })
}

// On how many different days one person recorded something.
export function activeDays(events: { at: Date }[]): number {
  return new Set(events.map((event) => dayKey(event.at))).size
}

export type FunnelUser = {
  createdAt: Date
  hasPlan: boolean
  expenses: number
  // The latest thing they recorded, whatever it was.
  lastEntryAt: Date | null
}

// How far people get: each step counts those who reached it. "After a week"
// means something was recorded seven days or more after signing up.
export function usageFunnel(users: FunnelUser[]) {
  const recordedAfter = (user: FunnelUser, days: number) =>
    user.lastEntryAt !== null && user.lastEntryAt.getTime() - user.createdAt.getTime() >= days * DAY
  const count = (reached: (user: FunnelUser) => boolean) => users.filter(reached).length

  return {
    signedUp: users.length,
    planSetUp: count((user) => user.hasPlan),
    firstExpense: count((user) => user.expenses > 0),
    afterAWeek: count((user) => recordedAfter(user, 7)),
    afterAMonth: count((user) => recordedAfter(user, 30)),
  }
}
