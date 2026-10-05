import { criterionOf } from '../../domain/career/criteria'
import { CareerRuleError } from '../../domain/career/errors'
import { evaluateCareerGoal } from '../../domain/career/goals'
import { changedResults, evidenceAsOf, isInWeek, weekOf } from '../../domain/career/week'
import { careerGoalRepository } from '../../infrastructure/repositories/careerGoalRepository'
import { careerOpportunityRepository } from '../../infrastructure/repositories/careerOpportunityRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { careerWeekRepository } from '../../infrastructure/repositories/careerWeekRepository'
import { journalRepository } from '../../infrastructure/repositories/journalRepository'
import { now as clockNow } from '../../lib/clock'
import { m } from '../../lib/i18n/translate'
import { createEntry, visibleEntry } from '../personal/journal'

// The two questions of the weekly review (spec §9.3). Answers are saved as
// Career log lines, titled with the question in the person's language.
export const REVIEW_QUESTIONS = {
  forward: m('What moved you forward?'),
  next: m('What changes next week?'),
} as const

// The weekly review: what changed during the week holding `day`.
export async function getCareerReview(userId: string, day: Date, now: Date = clockNow()) {
  const { start, end } = weekOf(day)
  // Up to now for this week, the whole week for a past one.
  const until = now < end ? now : new Date(end.getTime() - 1)

  const [facts, evidence, opportunities, goals, data, focus, entries, reviewDay] = await Promise.all([
    careerRepository.listFacts(userId),
    careerRepository.listEvidence(userId),
    careerOpportunityRepository.list(userId),
    careerGoalRepository.listGoals(userId),
    careerGoalRepository.loadEvidence(userId),
    careerWeekRepository.listFocus(userId, start),
    journalRepository.listEntriesBetween(userId, start, end),
    careerRepository.getReviewDay(userId),
  ])

  const before = evidenceAsOf(data, start)
  const after = evidenceAsOf(data, until)
  const criteria = goals
    .filter((g) => !g.abandonedAt && !g.supersededAt)
    .flatMap((goal) =>
      changedResults(evaluateCareerGoal(goal, before, start).results, evaluateCareerGoal(goal, after, until).results).map((change) => ({
        goalId: goal.id,
        goal: goal.name,
        criterion: criterionOf(change.condition),
        from: change.from,
        to: change.to,
      })),
    )

  return {
    start,
    end,
    isCurrent: now >= start && now < end,
    // 1 is Monday, 7 is Sunday.
    reviewDay,
    started: facts.filter((f) => isInWeek(f.validFrom, start, end)).map((f) => ({ id: f.id, kind: f.kind, title: f.title })),
    ended: facts.filter((f) => isInWeek(f.validTo, start, end)).map((f) => ({ id: f.id, kind: f.kind, title: f.title })),
    evidence: evidence.filter((e) => isInWeek(e.addedAt, start, end)).map((e) => ({ id: e.id, title: e.title, url: e.url })),
    moves: opportunities.flatMap((o) =>
      o.statusChanges.filter((c) => isInWeek(c.changedAt, start, end)).map((c) => ({ id: c.id, opportunityId: o.id, title: o.title, status: c.status, outcome: c.outcome })),
    ),
    criteria,
    focusDone: focus.filter((f) => f.status === 'DONE').map((f) => f.title),
    focusOpen: focus.filter((f) => f.status !== 'DONE').map((f) => f.title),
    log: entries.filter((e) => e.type === 'CAREER_LOG').map((e) => visibleEntry(e)),
  }
}

export type CareerReview = Awaited<ReturnType<typeof getCareerReview>>

export async function saveReviewAnswers(
  userId: string,
  answers: { forward: string | null; next: string | null },
  translate: (text: string) => string,
  now: Date = clockNow(),
) {
  const written = (Object.keys(REVIEW_QUESTIONS) as (keyof typeof REVIEW_QUESTIONS)[]).filter((key) => answers[key]?.trim())
  if (written.length === 0) throw new CareerRuleError('Answer at least one question.', 'forward')
  for (const key of written) {
    const text = answers[key]!.trim()
    if (text.length > 1000) throw new CareerRuleError('Keep it under 1,000 characters.', key)
    await createEntry(userId, { type: 'CAREER_LOG', title: translate(REVIEW_QUESTIONS[key]), body: text, mood: null, energy: null, entryDate: now, reviewOn: null, password: null })
  }
}
