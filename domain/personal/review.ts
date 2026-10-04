import type { GoalStatus } from '../goals/status'

// The weekly review (Personal spec §13): what was done, what slipped and why,
// how goals stand, where the time went. Pure: the caller loads the week.

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// The week holding `date`, Monday to the next Monday.
export function weekOf(date: Date): { start: Date; end: Date } {
  const day = startOfDay(date)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7))
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) }
}

export type ReviewInput = {
  completions: { taskId: string }[]
  carries: { taskId: string; days: number; reason: string | null }[]
  sessions: { goal: string | null; durationMin: number }[]
  goals: { id: string; name: string; status: GoalStatus; lifecycle: 'TERMINAL' | 'ONGOING' | 'MAINTENANCE' }[]
  stillRelevant: { id: string; title: string; carryCount: number }[]
  entries: number
}

const NO_REASON = 'none'

export function buildWeeklyReview(input: ReviewInput) {
  // Why tasks slipped, most common first. A slip without a reason counts too.
  const reasonCounts = new Map<string, number>()
  for (const carry of input.carries) {
    const reason = carry.reason ?? NO_REASON
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + carry.days)
  }
  const reasons = [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

  // Time by goal, the most first; sessions without a goal together.
  const byGoal = new Map<string | null, number>()
  for (const session of input.sessions) {
    byGoal.set(session.goal, (byGoal.get(session.goal) ?? 0) + session.durationMin)
  }

  const count = (statuses: GoalStatus[]) => input.goals.filter((g) => statuses.includes(g.status))
  const live = input.goals.filter((g) => g.status !== 'ABANDONED')

  return {
    tasksDone: input.completions.length,
    slips: input.carries.reduce((sum, c) => sum + c.days, 0),
    reasons,
    topReason: reasons.find((r) => r.reason !== NO_REASON)?.reason ?? null,
    stillRelevant: [...input.stillRelevant].sort((a, b) => b.carryCount - a.carryCount),
    sessions: {
      count: input.sessions.length,
      minutes: input.sessions.reduce((sum, s) => sum + s.durationMin, 0),
      byGoal: [...byGoal.entries()].map(([goal, minutes]) => ({ goal, minutes })).sort((a, b) => b.minutes - a.minutes),
    },
    goals: {
      total: live.length,
      onTrack: count(['ON_TRACK']),
      behind: count(['BEHIND']),
      achieved: count(['ACHIEVED']),
      // Habits: kept or slipping this week.
      habitsKept: live.filter((g) => g.lifecycle !== 'TERMINAL' && g.status === 'MAINTAINING'),
      habitsSlipping: live.filter((g) => g.lifecycle !== 'TERMINAL' && g.status !== 'MAINTAINING'),
    },
    entries: input.entries,
  }
}

export type WeeklyReview = ReturnType<typeof buildWeeklyReview>
