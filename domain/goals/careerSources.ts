import { isCurrent, primaryPosition, FACT_REVIEW_DAYS, type FactKind, type FactSource } from '../career/situation'
import type { Resolve, SourceAnswer, Subject } from './engine'
import { judgementAnswer, type Judgement } from './judgementSource'

// The Career measurement sources (Career spec §6.1), over data loaded
// beforehand: the person's facts, the opportunities' terms and the
// judgements.

export type CareerFactEvidence = {
  id: string
  kind: FactKind
  title: string
  validFrom: Date
  validTo: Date | null
  source: FactSource
  isPrimary: boolean
  lastReviewedAt: Date | null
  createdAt: Date
  evidenceCount: number
  monthlyCompensation: number | null
  workArrangement: string | null
  contractType: string | null
  weeklyHours: number | null
  location: string | null
}

// An opportunity's terms, for the same dimensions as a position.
export type OpportunityTerms = {
  id: string
  title: string
  monthlyCompensation: number | null
  workArrangement: string | null
  contractType: string | null
  weeklyHours: number | null
  location: string | null
  // When the terms were last changed.
  updatedAt: Date
}

export type CareerEvidence = {
  facts: CareerFactEvidence[]
  opportunities: OpportunityTerms[]
  judgements: Judgement[]
}

const DIMENSION_FIELDS = {
  monthly_compensation: 'monthlyCompensation',
  weekly_hours: 'weeklyHours',
  work_arrangement: 'workArrangement',
  contract_type: 'contractType',
  location: 'location',
} as const

type DimensionKey = keyof typeof DIMENSION_FIELDS
const TEXT_DIMENSIONS: DimensionKey[] = ['work_arrangement', 'contract_type', 'location']

const unknown = (describe: string | null = null): SourceAnswer => ({ points: [], emptyMeans: 'unknown', text: null, describe })

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// A dimension of the main position (SELF) or of an opportunity's terms.
function positionDimension(evidence: CareerEvidence, dimension: unknown, subject: Subject, now: Date): SourceAnswer {
  if (typeof dimension !== 'string' || !(dimension in DIMENSION_FIELDS)) return unknown()
  const key = dimension as DimensionKey
  const field = DIMENSION_FIELDS[key]

  const holder =
    subject.type === 'SELF'
      ? (() => {
          const primary = primaryPosition(evidence.facts, startOfDay(now))
          return primary ? { title: primary.fact.title, record: primary.fact, asOf: primary.fact.lastReviewedAt ?? primary.fact.createdAt, self: true } : null
        })()
      : (() => {
          const offer = evidence.opportunities.find((o) => o.id === subject.id)
          return offer ? { title: offer.title, record: offer, asOf: offer.updatedAt, self: false } : null
        })()
  if (!holder) return unknown()

  const describe = holder.self ? `position:${holder.title}` : `opportunity:${holder.title}`
  const value = holder.record[field]
  if (value === null || value === undefined) return unknown(describe)

  const answer: SourceAnswer = {
    points: TEXT_DIMENSIONS.includes(key) ? [] : [{ at: holder.asOf, value: Number(value) }],
    emptyMeans: 'unknown',
    text: TEXT_DIMENSIONS.includes(key) ? String(value) : null,
    describe,
    asOf: holder.asOf,
    // Only the person's own position goes stale; an offer's terms are as given.
    staleAfterDays: holder.self ? FACT_REVIEW_DAYS : null,
  }
  return answer
}

// 1 when a current fact of that kind and title is documented or confirmed,
// else 0. An opportunity does not change your qualifications: unknown.
function factEvidence(evidence: CareerEvidence, ref: Record<string, unknown>, subject: Subject, now: Date): SourceAnswer {
  if (subject.type !== 'SELF') return unknown()
  const match = typeof ref.match === 'string' ? ref.match.trim().toLowerCase() : ''
  const today = startOfDay(now)
  const facts = evidence.facts.filter((f) => f.kind === ref.factKind && f.title.trim().toLowerCase() === match && isCurrent(f, today))
  const backed = facts.find((f) => f.source !== 'SELF' || f.evidenceCount > 0)
  const shown = backed ?? facts[0] ?? null

  return {
    points: shown ? [{ at: shown.lastReviewedAt ?? shown.createdAt, value: backed ? 1 : 0 }] : [],
    emptyMeans: 'zero',
    describe: shown ? `fact:${shown.title}` : null,
    asOf: shown ? (shown.lastReviewedAt ?? shown.createdAt) : null,
    staleAfterDays: FACT_REVIEW_DAYS,
  }
}

export function careerResolver(evidence: CareerEvidence, now: Date): Resolve {
  return (condition, subject) => {
    switch (condition.source) {
      case 'POSITION_DIMENSION':
        return positionDimension(evidence, condition.sourceRef.dimension, subject, now)
      case 'FACT_EVIDENCE':
        return factEvidence(evidence, condition.sourceRef, subject, now)
      case 'JUDGEMENT':
        return judgementAnswer(evidence.judgements, condition.id, subject)
      default:
        throw new Error(`No measurement source for ${condition.source}`)
    }
  }
}
