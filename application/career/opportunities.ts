import { criterionOf } from '../../domain/career/criteria'
import { CareerRuleError } from '../../domain/career/errors'
import { evaluateCareerGoal } from '../../domain/career/goals'
import {
  checkOpportunity,
  checkStatusChange,
  positionFromOffer,
  sortOpportunities,
  type OpportunityInput,
  type OpportunityStatus,
} from '../../domain/career/opportunities'
import { primaryPosition } from '../../domain/career/situation'
import { startOfDay } from '../../domain/personal/tasks'
import { careerGoalRepository } from '../../infrastructure/repositories/careerGoalRepository'
import { careerOpportunityRepository } from '../../infrastructure/repositories/careerOpportunityRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'
import { addFact } from './situation'

type Deps = {
  opportunities: typeof careerOpportunityRepository
  goals: Pick<typeof careerGoalRepository, 'listGoals' | 'loadEvidence' | 'judgementsAbout' | 'addJudgement'>
  facts: typeof careerRepository
  listIncomes: (userId: string) => Promise<{ id: string; source: string; amount: unknown }[]>
}

const defaultDeps: Deps = {
  opportunities: careerOpportunityRepository,
  goals: careerGoalRepository,
  facts: careerRepository,
  listIncomes: financeRepository.listIncomes,
}

export async function listOpportunities(userId: string, deps: Deps = defaultDeps) {
  return sortOpportunities(await deps.opportunities.list(userId))
}

export type OpportunitySummary = Awaited<ReturnType<typeof listOpportunities>>[number]

// One opportunity: its terms and history, each linked goal evaluated against
// it, and what the accept sheet offers.
export async function getOpportunity(userId: string, id: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const [opportunity, goals, evidence, incomes] = await Promise.all([
    deps.opportunities.get(userId, id),
    deps.goals.listGoals(userId),
    deps.goals.loadEvidence(userId),
    deps.listIncomes(userId),
  ])
  if (!opportunity) return null

  const linked = new Set(opportunity.goals.map((g) => g.goalId))
  const subject = { type: 'OPPORTUNITY' as const, id }
  const primary = primaryPosition(evidence.facts, startOfDay(now))

  return {
    ...opportunity,
    goals: goals
      .filter((g) => linked.has(g.id))
      .map((goal) => {
        const evaluation = evaluateCareerGoal(goal, evidence, now, subject)
        return {
          id: goal.id,
          name: goal.name,
          summary: evaluation.summary,
          criteria: evaluation.results.map((result) => ({ result, criterion: criterionOf(result.condition) })),
        }
      }),
    allGoals: goals.filter((g) => !g.abandonedAt && !g.supersededAt).map((g) => ({ id: g.id, name: g.name, linked: linked.has(g.id) })),
    currentPosition: primary ? primary.fact.title : null,
    incomes: incomes.map((i) => ({ id: i.id, source: i.source, amount: Number(i.amount) })),
  }
}

async function checkGoals(userId: string, goalIds: string[], deps: Deps) {
  const wanted = [...new Set(goalIds)]
  const owned = await deps.opportunities.ownedGoalIds(userId, wanted)
  if (owned.size !== wanted.length) throw new CareerRuleError('Choose among your goals.', 'goalIds')
  return wanted
}

export async function addOpportunity(userId: string, input: OpportunityInput, goalIds: string[], deps: Deps = defaultDeps, now: Date = clockNow()) {
  const data = checkOpportunity(input)
  return deps.opportunities.create(userId, data, await checkGoals(userId, goalIds, deps), now)
}

export async function updateOpportunity(userId: string, id: string, input: OpportunityInput, deps: Deps = defaultDeps) {
  if (!(await deps.opportunities.update(userId, id, checkOpportunity(input)))) throw new CareerRuleError('This opportunity no longer exists.')
}

export async function linkGoals(userId: string, id: string, goalIds: string[], deps: Deps = defaultDeps) {
  if (!(await deps.opportunities.setGoals(userId, id, await checkGoals(userId, goalIds, deps)))) {
    throw new CareerRuleError('This opportunity no longer exists.')
  }
}

export async function moveOpportunity(
  userId: string,
  id: string,
  status: OpportunityStatus,
  outcome: string | null,
  now: Date = clockNow(),
  deps: Deps = defaultDeps,
) {
  const change = checkStatusChange(status, outcome)
  if (!(await deps.opportunities.setStatus(userId, id, change.status, change.outcome, now))) {
    throw new CareerRuleError('This opportunity no longer exists.')
  }
}

export async function deleteOpportunity(userId: string, id: string, deps: Deps = defaultDeps) {
  if (!(await deps.opportunities.remove(userId, id))) throw new CareerRuleError('This opportunity no longer exists.')
}

export type AcceptChoices = {
  // Create the new position from the terms, starting that day.
  createPosition: boolean
  startsOn: Date
  // End the current main position the day before.
  endCurrent: boolean
  // A Finance income its pay is linked to.
  incomeId: string | null
  // The offer becomes the situation: its judgements become the situation's.
  copyJudgements: boolean
}

// Accepting an offer (spec §8), in one step: closed as accepted, and what the
// person chose of the four follow-ups.
export async function acceptOffer(userId: string, id: string, choices: AcceptChoices, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const offer = await deps.opportunities.get(userId, id)
  if (!offer) throw new CareerRuleError('This opportunity no longer exists.')
  if (choices.incomeId && !(await deps.listIncomes(userId)).some((i) => i.id === choices.incomeId)) {
    throw new CareerRuleError('Choose one of your incomes.', 'incomeId')
  }

  const startsOn = startOfDay(choices.startsOn)
  if (choices.endCurrent) {
    const { facts } = await deps.goals.loadEvidence(userId)
    const current = primaryPosition(facts, startOfDay(now))
    // A position ends the day the new one starts, never before it began.
    if (current && current.fact.validFrom < startsOn) await deps.facts.updateFact(userId, current.fact.id, { validTo: startsOn })
  }

  if (choices.createPosition) {
    const created = await addFact(userId, { ...positionFromOffer(offer, startsOn), primary: true }, deps.facts)
    if (choices.incomeId) await deps.facts.updateFact(userId, created.id, { financeIncomeId: choices.incomeId })
  }

  if (choices.copyJudgements) {
    const seen = new Set<string>()
    for (const judgement of await deps.goals.judgementsAbout(userId, 'OPPORTUNITY', id)) {
      if (seen.has(judgement.conditionId)) continue
      seen.add(judgement.conditionId)
      await deps.goals.addJudgement(judgement.conditionId, {
        subjectType: 'SELF',
        subjectId: null,
        result: judgement.result,
        note: judgement.note,
        judgedAt: now,
      })
    }
  }

  await deps.opportunities.setStatus(userId, id, 'CLOSED', 'accepted', now)
}
