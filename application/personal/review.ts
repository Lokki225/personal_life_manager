import { buildWeeklyReview, weekOf } from '../../domain/personal/review'
import { STILL_RELEVANT_AFTER } from '../../domain/personal/tasks'
import { journalRepository } from '../../infrastructure/repositories/journalRepository'
import { personalRepository } from '../../infrastructure/repositories/personalRepository'
import { now as clockNow } from '../../lib/clock'
import { listPersonalGoals } from './goals'
import { visibleEntry } from './journal'

// The week holding `day`: what was done, what slipped and why, goals, time.
// Goals show how they stand now, even for a past week.
export async function getWeeklyReview(userId: string, day: Date, now: Date = clockNow()) {
  const { start, end } = weekOf(day)
  const [completions, carries, sessions, goals, tasks, entries] = await Promise.all([
    personalRepository.listCompletions(userId, start, end),
    personalRepository.listCarries(userId, start, end),
    personalRepository.listSessions(userId, start, end),
    listPersonalGoals(userId, now),
    personalRepository.listTasks(userId),
    journalRepository.listEntriesBetween(userId, start, end),
  ])

  const review = buildWeeklyReview({
    completions,
    carries,
    sessions: sessions.map((s) => ({ goal: s.goal?.name ?? null, durationMin: s.durationMin ?? 0 })),
    goals: goals.map((g) => ({ id: g.id, name: g.name, status: g.evaluation.status, lifecycle: g.lifecycle })),
    stillRelevant: tasks
      .filter((t) => t.status !== 'DONE' && t.carryCount >= STILL_RELEVANT_AFTER)
      .map((t) => ({ id: t.id, title: t.title, carryCount: t.carryCount })),
    entries: entries.length,
  })

  const written = entries.find((e) => e.type === 'REVIEW')

  return { start, end, review, reviewEntry: written ? visibleEntry(written) : null }
}
