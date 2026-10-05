import { CareerRuleError } from './errors'
import { checkTerms, checkUrl, type FactInput, type Terms } from './situation'

// Opportunities (Career spec §8): openings and offers, compared with what the
// person wants. Pure rules, no database.

export const OPPORTUNITY_KINDS = ['JOB', 'PROMOTION', 'FREELANCE', 'TRAINING', 'OTHER'] as const
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number]

// The pipeline, in order.
export const OPPORTUNITY_STATUSES = ['FOUND', 'APPLIED', 'INTERVIEWING', 'OFFER', 'CLOSED'] as const
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number]

// How a closed one ended.
export const OUTCOMES = ['accepted', 'declined', 'rejected', 'withdrawn', 'lapsed'] as const
export type Outcome = (typeof OUTCOMES)[number]

export type OpportunityInput = Terms & {
  title: string
  organisation: string | null
  kind: OpportunityKind
  sourceUrl: string | null
  notes: string | null
  deadline: Date | null
}

export function checkOpportunity(input: OpportunityInput): OpportunityInput {
  const title = input.title.trim()
  if (!title) throw new CareerRuleError('Give it a title.', 'title')
  if (title.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'title')
  if (!(OPPORTUNITY_KINDS as readonly string[]).includes(input.kind)) throw new CareerRuleError('Choose what it is.', 'kind')
  const organisation = input.organisation?.trim() || null
  if (organisation && organisation.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'organisation')
  const notes = input.notes?.trim() || null
  if (notes && notes.length > 2000) throw new CareerRuleError('Keep it under 2,000 characters.', 'notes')
  checkTerms(input)
  return { ...input, title, organisation, notes, sourceUrl: checkUrl(input.sourceUrl), location: input.location?.trim() || null }
}

// A move in the pipeline. Closing says how it ended; any other status has
// no outcome. Any move is allowed: things do go back.
export function checkStatusChange(status: OpportunityStatus, outcome: string | null): { status: OpportunityStatus; outcome: Outcome | null } {
  if (!(OPPORTUNITY_STATUSES as readonly string[]).includes(status)) throw new CareerRuleError('Choose a status.', 'status')
  if (status !== 'CLOSED') return { status, outcome: null }
  if (!outcome || !(OUTCOMES as readonly string[]).includes(outcome)) throw new CareerRuleError('Say how it ended.', 'outcome')
  return { status, outcome: outcome as Outcome }
}

// The position an accepted offer becomes, from its terms, starting on a day.
export function positionFromOffer(offer: OpportunityInput, startsOn: Date): FactInput {
  return {
    kind: 'POSITION',
    title: offer.title,
    details: null,
    validFrom: startsOn,
    validTo: null,
    organisation: offer.organisation,
    monthlyCompensation: offer.monthlyCompensation,
    workArrangement: offer.workArrangement,
    contractType: offer.contractType,
    weeklyHours: offer.weeklyHours,
    location: offer.location,
    issuer: null,
    obtainedAt: null,
    expiresAt: null,
    level: null,
    positionId: null,
  }
}

// Open ones first, by nearest deadline; closed ones last.
export function sortOpportunities<O extends { status: OpportunityStatus; deadline: Date | null; createdAt: Date }>(items: O[]): O[] {
  const key = (o: O) => [o.status === 'CLOSED' ? 1 : 0, o.deadline ? o.deadline.getTime() : Number.MAX_SAFE_INTEGER, -o.createdAt.getTime()]
  return [...items].sort((a, b) => {
    const [x, y] = [key(a), key(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })
}
