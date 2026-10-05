import type { ConditionResult } from '../goals/engine'
import type { CareerEvidence } from '../goals/careerSources'

// The weekly loop (Career spec §9): a few focus items per week, a quick log,
// and a review of what changed. Weeks start on Monday, on the person's clock.

// At most this many focus items in a week.
export const MAX_FOCUS = 3

const DAY = 86_400_000

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

// The Monday of the week holding `date`.
export function mondayOf(date: Date): Date {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() + 6) % 7))
}

export const weekOf = (date: Date) => {
  const start = mondayOf(date)
  return { start, end: addDays(start, 7) }
}

// "2026-10-05" as a Monday, or null when it is not a date.
export function parseWeek(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : mondayOf(date)
}

// The data the Career sources read, as it stood at a moment: facts recorded
// by then, evidence linked by then, judgements made by then. A fact's own
// details are as they are now (they keep no history).
export function evidenceAsOf(evidence: CareerEvidence & { evidenceDates?: Map<string, Date[]> }, at: Date): CareerEvidence {
  return {
    facts: evidence.facts
      .filter((f) => f.createdAt <= at && f.validFrom <= at)
      .map((f) => {
        const dates = evidence.evidenceDates?.get(f.id)
        return {
          ...f,
          // Ended later means still true then.
          validTo: f.validTo && f.validTo > at ? null : f.validTo,
          evidenceCount: dates ? dates.filter((d) => d <= at).length : f.evidenceCount,
        }
      }),
    opportunities: evidence.opportunities,
    judgements: evidence.judgements.filter((j) => j.judgedAt <= at),
  }
}

// The criteria whose result is not the same at the end as at the start.
export function changedResults(before: ConditionResult[], after: ConditionResult[]) {
  const was = new Map(before.map((r) => [r.condition.id, r.result]))
  return after
    .filter((r) => was.has(r.condition.id) && was.get(r.condition.id) !== r.result)
    .map((r) => ({ condition: r.condition, from: was.get(r.condition.id)!, to: r.result }))
}

export const isInWeek = (date: Date | null, start: Date, end: Date) => date !== null && date >= start && date < end

export const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)
