import { CareerRuleError } from '../../domain/career/errors'
import { isCurrent } from '../../domain/career/situation'
import { addDays, MAX_FOCUS, mondayOf, startOfDay, weekOf } from '../../domain/career/week'
import { careerGoalRepository } from '../../infrastructure/repositories/careerGoalRepository'
import { careerOpportunityRepository } from '../../infrastructure/repositories/careerOpportunityRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { careerWeekRepository, type CareerWeekRepository } from '../../infrastructure/repositories/careerWeekRepository'
import { journalRepository } from '../../infrastructure/repositories/journalRepository'
import { now as clockNow } from '../../lib/clock'
import { visibleEntry } from '../personal/journal'

type Deps = CareerWeekRepository

// The Week view (Career spec §12): this week's focus, what is left from
// before, the quick log of the week, and what is coming up.
export async function getWeek(userId: string, now: Date = clockNow()) {
  const today = startOfDay(now)
  const { start, end } = weekOf(today)
  const [focus, leftOver, entries, opportunities, goals, facts] = await Promise.all([
    careerWeekRepository.listFocus(userId, start),
    careerWeekRepository.listLeftOver(userId, start),
    journalRepository.listEntriesBetween(userId, start, end),
    careerOpportunityRepository.list(userId),
    careerGoalRepository.listGoals(userId),
    careerRepository.listFacts(userId),
  ])
  const soon = addDays(today, 14)
  const openGoals = goals.filter((g) => !g.achievedAt && !g.abandonedAt && !g.supersededAt)
  const openOpportunities = opportunities.filter((o) => o.status !== 'CLOSED')

  return {
    start,
    focus,
    leftOver,
    log: entries.filter((e) => e.type === 'CAREER_LOG').reverse().map((e) => visibleEntry(e)),
    // Opportunity and goal deadlines in the next two weeks.
    deadlines: [
      ...openOpportunities.filter((o) => o.deadline && o.deadline >= today && o.deadline <= soon).map((o) => ({ kind: 'opportunity' as const, id: o.id, title: o.title, date: o.deadline! })),
      ...openGoals.filter((g) => g.deadline && g.deadline >= today && g.deadline <= soon).map((g) => ({ kind: 'goal' as const, id: g.id, title: g.name, date: g.deadline! })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime()),
    goals: openGoals.map((g) => ({ id: g.id, name: g.name })),
    opportunities: openOpportunities.map((o) => ({ id: o.id, title: o.title, status: o.status })),
    // Current facts, for the log's "ended" and "evidence for".
    facts: facts.filter((f) => isCurrent(f, today)).map((f) => ({ id: f.id, title: f.title, kind: f.kind })),
  }
}

export type CareerWeek = Awaited<ReturnType<typeof getWeek>>

async function roomIn(userId: string, week: Date, deps: Deps) {
  if ((await deps.countFocus(userId, week)) >= MAX_FOCUS) {
    throw new CareerRuleError('Three focus items a week at most. Finish or move one first.')
  }
}

export async function addFocus(
  userId: string,
  input: { title: string; goalId: string | null; opportunityId: string | null },
  now: Date = clockNow(),
  deps: Deps = careerWeekRepository,
) {
  const title = input.title.trim()
  if (!title) throw new CareerRuleError('Say what you will do.', 'title')
  if (title.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'title')
  if (input.goalId && !(await deps.ownsGoal(userId, input.goalId))) throw new CareerRuleError('Choose one of your goals.', 'goalId')
  if (input.opportunityId && !(await deps.ownsOpportunity(userId, input.opportunityId))) {
    throw new CareerRuleError('Choose one of your opportunities.', 'opportunityId')
  }
  const week = mondayOf(now)
  await roomIn(userId, week, deps)
  return deps.addFocus(userId, { title, week, goalId: input.goalId, opportunityId: input.opportunityId })
}

export async function setFocusDone(userId: string, id: string, done: boolean, deps: Deps = careerWeekRepository) {
  if (!(await deps.setStatus(userId, id, done ? 'DONE' : 'OPEN'))) throw new CareerRuleError('This focus item no longer exists.')
}

export async function removeFocus(userId: string, id: string, deps: Deps = careerWeekRepository) {
  if (!(await deps.setStatus(userId, id, 'DROPPED'))) throw new CareerRuleError('This focus item no longer exists.')
}

// "Carry to next week": this week's unfinished items, in one tap.
export async function carryToNextWeek(userId: string, now: Date = clockNow(), deps: Deps = careerWeekRepository) {
  const week = mondayOf(now)
  const open = (await deps.listFocus(userId, week)).filter((f) => f.status === 'OPEN')
  if (open.length === 0) return 0
  return deps.moveFocus(userId, open.map((f) => f.id), addDays(week, 7))
}

// An item left from an earlier week, brought into this one.
export async function bringToThisWeek(userId: string, id: string, now: Date = clockNow(), deps: Deps = careerWeekRepository) {
  const item = await deps.getFocus(userId, id)
  if (!item) throw new CareerRuleError('This focus item no longer exists.')
  const week = mondayOf(now)
  await roomIn(userId, week, deps)
  await deps.moveFocus(userId, [id], week)
}
