import { checkCriterion, conditionOf, criterionOf, type Criterion } from '../../domain/career/criteria'
import { CareerRuleError } from '../../domain/career/errors'
import { evaluateCareerGoal, isClosed } from '../../domain/career/goals'
import { primaryPosition } from '../../domain/career/situation'
import { startOfDay } from '../../domain/personal/tasks'
import { careerGoalRepository, type CareerGoalFields, type CareerGoalRepository } from '../../infrastructure/repositories/careerGoalRepository'
import { careerRepository } from '../../infrastructure/repositories/careerRepository'
import { now as clockNow } from '../../lib/clock'

type Deps = CareerGoalRepository & Pick<typeof careerRepository, 'getLocations' | 'updateFact'>
const defaultDeps: Deps = { ...careerGoalRepository, getLocations: careerRepository.getLocations, updateFact: careerRepository.updateFact }

export const IMPORTANCES = ['LOW', 'MEDIUM', 'HIGH'] as const

// Career goals, each with its evaluation against the current situation.
// Goals still open come first.
export async function listCareerGoals(userId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const [goals, evidence] = await Promise.all([deps.listGoals(userId), deps.loadEvidence(userId)])
  const evaluated = goals.map((goal) => ({ ...goal, evaluation: evaluateCareerGoal(goal, evidence, now) }))
  return [...evaluated.filter((g) => !isClosed(g.evaluation.status)), ...evaluated.filter((g) => isClosed(g.evaluation.status))]
}

export type CareerGoalSummary = Awaited<ReturnType<typeof listCareerGoals>>[number]

// One goal: its criteria with their results, and what the page offers.
export async function getCareerGoal(userId: string, id: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const [goal, evidence, places, goals] = await Promise.all([deps.getGoal(userId, id), deps.loadEvidence(userId), deps.getLocations(userId), deps.listGoals(userId)])
  if (!goal) return null

  const evaluation = evaluateCareerGoal(goal, evidence, now)
  return {
    ...goal,
    evaluation,
    criteria: evaluation.results.map((result) => ({ result, criterion: criterionOf(result.condition) })),
    places,
    // Goals it could be replaced by.
    others: goals.filter((g) => g.id !== id && !g.abandonedAt && !g.supersededAt).map((g) => ({ id: g.id, name: g.name })),
    supersededBy: goal.supersededById ? (goals.find((g) => g.id === goal.supersededById)?.name ?? null) : null,
  }
}

function checkFields(fields: CareerGoalFields): CareerGoalFields {
  const name = fields.name.trim()
  if (!name) throw new CareerRuleError('Say what you want.', 'name')
  if (name.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'name')
  const why = fields.why?.trim() || null
  if (why && why.length > 1000) throw new CareerRuleError('Keep it under 1,000 characters.', 'why')
  if (fields.importance && !(IMPORTANCES as readonly string[]).includes(fields.importance)) throw new CareerRuleError('Choose how much it matters.', 'importance')
  return { ...fields, name, why }
}

export async function createCareerGoal(userId: string, fields: CareerGoalFields, deps: Deps = defaultDeps) {
  return deps.createGoal(userId, checkFields(fields))
}

export async function updateCareerGoal(userId: string, id: string, fields: CareerGoalFields, deps: Deps = defaultDeps) {
  if (!(await deps.updateGoal(userId, id, checkFields(fields)))) throw new CareerRuleError('This goal no longer exists.')
}

export async function addCriterion(userId: string, goalId: string, criterion: Criterion, deps: Deps = defaultDeps) {
  const checked = checkCriterion(criterion, await deps.getLocations(userId))
  if (!(await deps.addCondition(userId, goalId, conditionOf(checked)))) throw new CareerRuleError('This goal no longer exists.')
}

export async function removeCriterion(userId: string, goalId: string, conditionId: string, deps: Deps = defaultDeps) {
  if (!(await deps.deleteCondition(userId, goalId, conditionId))) throw new CareerRuleError('This criterion no longer exists.')
}

// Your verdict on a criterion that cannot be measured.
export async function judge(
  userId: string,
  conditionId: string,
  result: 'MET' | 'GAP' | 'UNKNOWN',
  note: string | null,
  now: Date = clockNow(),
  deps: Deps = defaultDeps,
) {
  const condition = await deps.getCondition(userId, conditionId)
  if (!condition || condition.source !== 'JUDGEMENT') throw new CareerRuleError('This criterion no longer exists.')
  const text = note?.trim() || null
  if (text && text.length > 280) throw new CareerRuleError('Keep it under 280 characters.', 'note')
  await deps.addJudgement(conditionId, { subjectType: 'SELF', subjectId: null, result, note: text, judgedAt: now })
}

// "Mark as reviewed" on a criterion: the fact it rests on was looked at now.
export async function markCriterionReviewed(userId: string, conditionId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const condition = await deps.getCondition(userId, conditionId)
  if (!condition) throw new CareerRuleError('This criterion no longer exists.')
  const { facts } = await deps.loadEvidence(userId)
  const today = startOfDay(now)

  const factId =
    condition.source === 'POSITION_DIMENSION'
      ? (primaryPosition(facts, today)?.fact.id ?? null)
      : condition.source === 'FACT_EVIDENCE'
        ? (facts.find(
            (f) =>
              f.kind === condition.sourceRef.factKind &&
              f.title.trim().toLowerCase() === String(condition.sourceRef.match).trim().toLowerCase() &&
              (f.validTo === null || f.validTo > today),
          )?.id ?? null)
        : null

  if (!factId) throw new CareerRuleError('There is nothing to review yet.')
  await deps.updateFact(userId, factId, { lastReviewedAt: now })
}

async function setState(userId: string, id: string, state: Parameters<Deps['updateGoal']>[2], deps: Deps) {
  if (!(await deps.updateGoal(userId, id, state))) throw new CareerRuleError('This goal no longer exists.')
}

// Achieved is the person's call: the app only says when the criteria are met.
export const confirmAchieved = (userId: string, id: string, now: Date = clockNow(), deps: Deps = defaultDeps) =>
  setState(userId, id, { achievedAt: now, pausedAt: null }, deps)

export const reopenGoal = (userId: string, id: string, deps: Deps = defaultDeps) =>
  setState(userId, id, { achievedAt: null, abandonedAt: null, abandonReason: null, supersededAt: null, supersededById: null }, deps)

export const pauseGoal = (userId: string, id: string, now: Date = clockNow(), deps: Deps = defaultDeps) => setState(userId, id, { pausedAt: now }, deps)

export const resumeGoal = (userId: string, id: string, deps: Deps = defaultDeps) => setState(userId, id, { pausedAt: null }, deps)

export async function abandonCareerGoal(userId: string, id: string, reason: string | null, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const text = reason?.trim() || null
  if (text && text.length > 280) throw new CareerRuleError('Keep it under 280 characters.', 'reason')
  await setState(userId, id, { abandonedAt: now, abandonReason: text }, deps)
}

// Replaced by another of the person's Career goals: kept, never a failure.
export async function supersedeGoal(userId: string, id: string, byId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  if (byId === id || !(await deps.getGoal(userId, byId))) throw new CareerRuleError('Choose another of your goals.', 'byId')
  await setState(userId, id, { supersededAt: now, supersededById: byId }, deps)
}
