import { CareerRuleError } from '../../domain/career/errors'
import {
  checkFact,
  checkLocations,
  checkUrl,
  FACT_KINDS,
  isCurrent,
  isReviewDue,
  primaryPosition,
  sourceWithEvidence,
  type FactInput,
  type FactKind,
} from '../../domain/career/situation'
import { startOfDay } from '../../domain/personal/tasks'
import { careerRepository, type CareerRepository } from '../../infrastructure/repositories/careerRepository'
import { now as clockNow } from '../../lib/clock'

type Deps = CareerRepository

// The current situation: facts true today grouped by kind, the past ones on
// request, the position goals compare with, and the evidence.
export async function getSituation(userId: string, now: Date = clockNow(), deps: Deps = careerRepository) {
  const today = startOfDay(now)
  const [facts, evidence, locations] = await Promise.all([deps.listFacts(userId), deps.listEvidence(userId), deps.getLocations(userId)])

  const shown = facts.map((fact) => ({
    ...fact,
    monthlyCompensation: fact.monthlyCompensation === null ? null : Number(fact.monthlyCompensation),
    evidenceIds: fact.evidence.map((e) => e.evidenceId),
    current: isCurrent(fact, today),
    reviewDue: isReviewDue(fact, now),
  }))
  const current = shown.filter((f) => f.current)
  const byKind = Object.fromEntries(FACT_KINDS.map((kind) => [kind, current.filter((f) => f.kind === kind)])) as Record<FactKind, typeof shown>

  return {
    byKind,
    past: shown.filter((f) => !f.current),
    primary: primaryPosition(shown, today),
    evidence: evidence.map((e) => ({ ...e, factIds: e.facts.map((f) => f.factId) })),
    locations,
  }
}

export type Situation = Awaited<ReturnType<typeof getSituation>>

async function ownFact(userId: string, id: string, deps: Deps) {
  const fact = await deps.getFact(userId, id)
  if (!fact) throw new CareerRuleError('This fact no longer exists.')
  return fact
}

// A new fact. A position marked primary unmarks the others.
export async function addFact(userId: string, input: FactInput & { primary?: boolean }, deps: Deps = careerRepository) {
  const { primary, ...rest } = input
  const fact = checkFact(rest)
  if (fact.positionId && !(await deps.ownedFactIds(userId, [fact.positionId])).has(fact.positionId)) {
    throw new CareerRuleError('Choose one of your positions.', 'positionId')
  }
  const created = await deps.createFact(userId, fact)
  if (primary && fact.kind === 'POSITION') await deps.setPrimary(userId, created.id)
  return created
}

// Changes a fact's details. Its kind stays (a kind given is ignored);
// "confirmed" is the person saying it is checked, without needing evidence.
export async function updateFact(
  userId: string,
  id: string,
  input: Omit<FactInput, 'kind'> & { kind?: FactKind; confirmed: boolean },
  deps: Deps = careerRepository,
) {
  const existing = await ownFact(userId, id, deps)
  const { confirmed, ...rest } = input
  const fact = checkFact({ ...rest, kind: existing.kind })
  if (fact.positionId && (fact.positionId === id || !(await deps.ownedFactIds(userId, [fact.positionId])).has(fact.positionId))) {
    throw new CareerRuleError('Choose one of your positions.', 'positionId')
  }
  const source = confirmed ? 'CONFIRMED' : sourceWithEvidence('SELF', existing.evidence.length)
  await deps.updateFact(userId, id, { ...fact, source })
}

// A fact stops being true on a day; it is kept as history.
export async function endFact(userId: string, id: string, validTo: Date, deps: Deps = careerRepository) {
  const fact = await ownFact(userId, id, deps)
  if (validTo < fact.validFrom) throw new CareerRuleError('The end comes after the start.', 'validTo')
  await deps.updateFact(userId, id, { validTo })
}

export async function makePrimary(userId: string, id: string, now: Date = clockNow(), deps: Deps = careerRepository) {
  const fact = await ownFact(userId, id, deps)
  if (fact.kind !== 'POSITION' || !isCurrent(fact, startOfDay(now))) {
    throw new CareerRuleError('Only a current position can be the main one.')
  }
  await deps.setPrimary(userId, id)
}

export async function markReviewed(userId: string, id: string, now: Date = clockNow(), deps: Deps = careerRepository) {
  await ownFact(userId, id, deps)
  await deps.updateFact(userId, id, { lastReviewedAt: now })
}

// Sets each fact's source from its evidence, after links changed.
async function refreshSources(userId: string, factIds: string[], deps: Deps) {
  if (factIds.length === 0) return
  const counts = await deps.evidenceCounts(userId, factIds)
  for (const factId of factIds) {
    const fact = await deps.getFact(userId, factId)
    if (fact) await deps.updateFact(userId, factId, { source: sourceWithEvidence(fact.source, counts.get(factId) ?? 0) })
  }
}

export async function addEvidence(
  userId: string,
  input: { title: string; url: string | null; description: string | null; factIds: string[] },
  deps: Deps = careerRepository,
  now: Date = clockNow(),
) {
  const title = input.title.trim()
  if (!title) throw new CareerRuleError('Give it a title.', 'title')
  if (title.length > 120) throw new CareerRuleError('Keep it under 120 characters.', 'title')
  const description = input.description?.trim() || null
  if (description && description.length > 1000) throw new CareerRuleError('Keep it under 1,000 characters.', 'description')
  const url = checkUrl(input.url)

  const wanted = [...new Set(input.factIds)]
  const owned = await deps.ownedFactIds(userId, wanted)
  if (owned.size !== wanted.length) throw new CareerRuleError('Choose among your facts.', 'factIds')

  // Dated on the person's clock, like the week it shows up in.
  const created = await deps.createEvidence(userId, { title, url, description, addedAt: now }, wanted)
  await refreshSources(userId, wanted, deps)
  return created
}

export async function linkEvidence(userId: string, evidenceId: string, factId: string, deps: Deps = careerRepository) {
  if (!(await deps.link(userId, evidenceId, factId))) throw new CareerRuleError('This evidence or fact no longer exists.')
  await refreshSources(userId, [factId], deps)
}

export async function unlinkEvidence(userId: string, evidenceId: string, factId: string, deps: Deps = careerRepository) {
  await deps.unlink(userId, evidenceId, factId)
  await refreshSources(userId, [factId], deps)
}

export async function deleteEvidence(userId: string, id: string, deps: Deps = careerRepository) {
  const evidence = await deps.getEvidence(userId, id)
  if (!evidence) throw new CareerRuleError('This evidence no longer exists.')
  await deps.deleteEvidence(userId, id)
  await refreshSources(userId, evidence.facts.map((f) => f.factId), deps)
}

export async function saveLocations(userId: string, places: string[], deps: Deps = careerRepository) {
  await deps.setLocations(userId, checkLocations(places))
}
