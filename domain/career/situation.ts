import { CareerRuleError } from './errors'

// The current situation (Career spec §3–4): dated facts about the person's
// professional life, and the evidence behind them. Pure rules, no database.

export const FACT_KINDS = ['POSITION', 'QUALIFICATION', 'SKILL', 'EXPERIENCE'] as const
export type FactKind = (typeof FACT_KINDS)[number]

export type FactSource = 'SELF' | 'DOCUMENTED' | 'CONFIRMED'

// The values a position's choice dimensions can take (goal "choice" criteria
// compare with them). Locations are the person's own list.
export const WORK_ARRANGEMENTS = ['on_site', 'hybrid', 'remote'] as const
export const CONTRACT_TYPES = ['permanent', 'fixed_term', 'freelance', 'internship', 'other'] as const

// A fact not looked at for this long is due for review.
export const FACT_REVIEW_DAYS = 180

const DAY = 86_400_000

export type FactDates = {
  validFrom: Date
  validTo: Date | null
}

// True on a day from its start until the day it ended (that day excluded:
// a position ended today is no longer current).
export const isCurrent = (fact: FactDates, today: Date) => fact.validFrom <= today && (fact.validTo === null || fact.validTo > today)

export type PositionLike = FactDates & { id: string; kind: FactKind; isPrimary: boolean }

// The position goals compare with: the one marked primary, or else the one
// started last (and the page says it was chosen that way).
export function primaryPosition<F extends PositionLike>(facts: F[], today: Date): { fact: F; chosen: 'only' | 'marked' | 'latest' } | null {
  const positions = facts.filter((f) => f.kind === 'POSITION' && isCurrent(f, today))
  if (positions.length === 0) return null
  if (positions.length === 1) return { fact: positions[0], chosen: 'only' }

  const marked = positions.find((p) => p.isPrimary)
  if (marked) return { fact: marked, chosen: 'marked' }

  const latest = [...positions].sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0]
  return { fact: latest, chosen: 'latest' }
}

// Linking evidence documents a fact; removing the last link takes that back.
// A fact the person confirmed stays confirmed.
export const sourceWithEvidence = (source: FactSource, evidenceCount: number): FactSource =>
  source === 'CONFIRMED' ? 'CONFIRMED' : evidenceCount > 0 ? 'DOCUMENTED' : 'SELF'

export const isReviewDue = (fact: { lastReviewedAt: Date | null; createdAt: Date }, now: Date) =>
  now.getTime() - (fact.lastReviewedAt ?? fact.createdAt).getTime() > FACT_REVIEW_DAYS * DAY

export type FactInput = {
  kind: FactKind
  title: string
  details: string | null
  validFrom: Date
  validTo: Date | null
  organisation: string | null
  monthlyCompensation: number | null
  workArrangement: string | null
  contractType: string | null
  weeklyHours: number | null
  location: string | null
  issuer: string | null
  obtainedAt: Date | null
  expiresAt: Date | null
  level: string | null
  positionId: string | null
}

// Fields of other kinds are dropped, so a skill never carries a salary.
const KIND_FIELDS: Record<FactKind, (keyof FactInput)[]> = {
  POSITION: ['organisation', 'monthlyCompensation', 'workArrangement', 'contractType', 'weeklyHours', 'location'],
  QUALIFICATION: ['issuer', 'obtainedAt', 'expiresAt'],
  SKILL: ['level'],
  EXPERIENCE: ['positionId'],
}
const KIND_SPECIFIC: (keyof FactInput)[] = Object.values(KIND_FIELDS).flat()

// Checks a fact and keeps only what its kind uses. Throws a CareerRuleError
// naming the field when something is wrong.
export function checkFact(input: FactInput): FactInput {
  const title = input.title.trim()
  if (!title) throw new CareerRuleError('Give it a title.', 'title')
  if (title.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'title')
  if (input.details && input.details.length > 1000) throw new CareerRuleError('Keep it under 1,000 characters.', 'details')
  if (input.validTo && input.validTo < input.validFrom) throw new CareerRuleError('The end comes after the start.', 'validTo')

  if (input.kind === 'POSITION') {
    const pay = input.monthlyCompensation
    if (pay !== null && (!Number.isFinite(pay) || pay < 0 || pay > 999_999_999_999)) {
      throw new CareerRuleError('Enter a monthly amount, for example 450000.', 'monthlyCompensation')
    }
    if (input.weeklyHours !== null && (!Number.isInteger(input.weeklyHours) || input.weeklyHours < 0 || input.weeklyHours > 168)) {
      throw new CareerRuleError('Enter between 0 and 168 hours.', 'weeklyHours')
    }
    if (input.workArrangement && !(WORK_ARRANGEMENTS as readonly string[]).includes(input.workArrangement)) {
      throw new CareerRuleError('Choose how you work.', 'workArrangement')
    }
    if (input.contractType && !(CONTRACT_TYPES as readonly string[]).includes(input.contractType)) {
      throw new CareerRuleError('Choose a contract type.', 'contractType')
    }
  }
  if (input.kind === 'QUALIFICATION' && input.obtainedAt && input.expiresAt && input.expiresAt < input.obtainedAt) {
    throw new CareerRuleError('It expires after it was obtained.', 'expiresAt')
  }

  const kept = { ...input, title, details: input.details?.trim() || null }
  for (const field of KIND_SPECIFIC) {
    if (!KIND_FIELDS[input.kind].includes(field)) (kept as Record<string, unknown>)[field] = null
  }
  return kept
}

// A link a page can safely open: http or https only, never javascript: or
// data:, which would run in the app.
export function checkUrl(url: string | null): string | null {
  const text = url?.trim()
  if (!text) return null
  if (text.length > 2000) throw new CareerRuleError('This link is too long.', 'url')
  try {
    const parsed = new URL(text)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    // Falls through to the error below.
  }
  throw new CareerRuleError('Enter a full link, starting with https://', 'url')
}

// The person's places for "location" criteria: trimmed, without repeats.
export function checkLocations(places: string[]): string[] {
  const kept: string[] = []
  for (const place of places.map((p) => p.trim()).filter(Boolean)) {
    if (place.length > 60) throw new CareerRuleError('Keep each place under 60 characters.', 'locations')
    if (!kept.some((k) => k.toLowerCase() === place.toLowerCase())) kept.push(place)
  }
  if (kept.length > 30) throw new CareerRuleError('Keep it to 30 places.', 'locations')
  return kept
}
