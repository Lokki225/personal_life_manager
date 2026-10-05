import { CareerRuleError } from '../../domain/career/errors'
import type { OpportunityStatus } from '../../domain/career/opportunities'
import { FACT_KINDS, type FactKind } from '../../domain/career/situation'
import { startOfDay } from '../../domain/career/week'
import { linkToken, type JournalLink } from '../../domain/personal/journal'
import { careerGoalRepository } from '../../infrastructure/repositories/careerGoalRepository'
import { careerOpportunityRepository } from '../../infrastructure/repositories/careerOpportunityRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { now as clockNow } from '../../lib/clock'
import { createEntry } from '../personal/journal'
import { moveOpportunity } from './opportunities'
import { addEvidence, addFact, endFact } from './situation'

// The Career quick log (spec §9.2): a short line, linked to what it is about.
// Written from a log line, in one step: a new fact, a fact that ended,
// evidence for a fact, an opportunity's next step. What it creates is linked
// to the line.

export type LogAlso =
  | { kind: 'none' }
  | { kind: 'newFact'; factKind: FactKind; title: string }
  | { kind: 'endFact'; factId: string }
  | { kind: 'evidence'; factId: string; title: string; url: string | null }
  | { kind: 'move'; opportunityId: string; status: OpportunityStatus; outcome: string | null }

export type LogInput = { body: string; goalId: string | null; opportunityId: string | null; also: LogAlso }

export const MAX_LOG = 500

const emptyFact = {
  details: null,
  validTo: null,
  organisation: null,
  monthlyCompensation: null,
  workArrangement: null,
  contractType: null,
  weeklyHours: null,
  location: null,
  issuer: null,
  obtainedAt: null,
  expiresAt: null,
  level: null,
  positionId: null,
}

async function doAlso(userId: string, also: LogAlso, now: Date): Promise<JournalLink[]> {
  const today = startOfDay(now)
  switch (also.kind) {
    case 'none':
      return []
    case 'newFact': {
      if (!(FACT_KINDS as readonly string[]).includes(also.factKind)) throw new CareerRuleError('Choose what it is.', 'factKind')
      const fact = await addFact(userId, { ...emptyFact, kind: also.factKind, title: also.title, validFrom: today })
      return [{ targetType: 'careerFact', targetId: fact.id, label: also.title.trim() }]
    }
    case 'endFact': {
      const fact = await careerRepository.getFact(userId, also.factId)
      if (!fact) throw new CareerRuleError('This fact no longer exists.', 'factId')
      await endFact(userId, also.factId, today)
      return [{ targetType: 'careerFact', targetId: fact.id, label: fact.title }]
    }
    case 'evidence': {
      const fact = await careerRepository.getFact(userId, also.factId)
      if (!fact) throw new CareerRuleError('This fact no longer exists.', 'factId')
      const evidence = await addEvidence(userId, { title: also.title, url: also.url, description: null, factIds: [fact.id] }, undefined, now)
      return [
        { targetType: 'careerEvidence', targetId: evidence.id, label: also.title.trim() },
        { targetType: 'careerFact', targetId: fact.id, label: fact.title },
      ]
    }
    case 'move': {
      const opportunity = await careerOpportunityRepository.get(userId, also.opportunityId)
      if (!opportunity) throw new CareerRuleError('This opportunity no longer exists.', 'opportunityId')
      await moveOpportunity(userId, also.opportunityId, also.status, also.outcome, now)
      return [{ targetType: 'careerOpportunity', targetId: opportunity.id, label: opportunity.title }]
    }
  }
}

export async function writeLog(userId: string, input: LogInput, now: Date = clockNow()) {
  const text = input.body.trim()
  if (!text) throw new CareerRuleError('Write a line first.', 'body')
  if (text.length > MAX_LOG) throw new CareerRuleError('Keep it under 500 characters.', 'body')

  const links: JournalLink[] = []
  if (input.goalId) {
    const goal = await careerGoalRepository.getGoal(userId, input.goalId)
    if (!goal) throw new CareerRuleError('Choose one of your goals.', 'goalId')
    links.push({ targetType: 'careerGoal', targetId: goal.id, label: goal.name })
  }
  if (input.opportunityId) {
    const opportunity = await careerOpportunityRepository.get(userId, input.opportunityId)
    if (!opportunity) throw new CareerRuleError('Choose one of your opportunities.', 'opportunityId')
    links.push({ targetType: 'careerOpportunity', targetId: opportunity.id, label: opportunity.title })
  }

  // The record first: the line then links to it.
  links.push(...(await doAlso(userId, input.also, now)))

  const unique = links.filter((link, i) => links.findIndex((l) => l.targetType === link.targetType && l.targetId === link.targetId) === i)
  const body = unique.length > 0 ? `${text}\n${unique.map(linkToken).join(' ')}` : text
  return createEntry(userId, { type: 'CAREER_LOG', title: null, body, mood: null, energy: null, entryDate: now, reviewOn: null, password: null })
}
