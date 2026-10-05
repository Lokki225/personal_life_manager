import { checkArea, LifeAreaRuleError, MAX_AREAS, moved, type AreaInput } from '../../domain/lifeAreas/areas'
import { lifeAreaRepository, type LifeAreaRepository } from '../../infrastructure/repositories/lifeAreaRepository'

type Deps = LifeAreaRepository

// The person's life areas, in their order, with how many goals each holds.
export async function listLifeAreas(userId: string, deps: Deps = lifeAreaRepository) {
  return (await deps.list(userId)).map(({ _count, ...area }) => ({ ...area, goals: _count.goals }))
}

export type LifeAreaSummary = Awaited<ReturnType<typeof listLifeAreas>>[number]

export async function createLifeArea(userId: string, input: AreaInput, deps: Deps = lifeAreaRepository) {
  const areas = await deps.list(userId)
  if (areas.length >= MAX_AREAS) throw new LifeAreaRuleError('Twelve areas at most. A life has only so many parts.')
  return deps.create(userId, checkArea(input, areas), areas.length)
}

export async function updateLifeArea(userId: string, id: string, input: AreaInput, deps: Deps = lifeAreaRepository) {
  const area = checkArea(input, await deps.list(userId), id)
  if (!(await deps.update(userId, id, area))) throw new LifeAreaRuleError('This area no longer exists.')
}

export async function removeLifeArea(userId: string, id: string, deps: Deps = lifeAreaRepository) {
  if (!(await deps.remove(userId, id))) throw new LifeAreaRuleError('This area no longer exists.')
}

export async function moveLifeArea(userId: string, id: string, direction: 'up' | 'down', deps: Deps = lifeAreaRepository) {
  const ids = (await deps.list(userId)).map((a) => a.id)
  if (!ids.includes(id)) throw new LifeAreaRuleError('This area no longer exists.')
  await deps.reorder(userId, moved(ids, id, direction))
}

// The area a Personal or Career goal serves, or none.
export async function setGoalArea(userId: string, goalId: string, lifeAreaId: string | null, deps: Deps = lifeAreaRepository) {
  if (lifeAreaId && !(await deps.owns(userId, lifeAreaId))) throw new LifeAreaRuleError('Choose one of your areas.', 'lifeAreaId')
  if (!(await deps.setGoalArea(userId, goalId, lifeAreaId))) throw new LifeAreaRuleError('This goal no longer exists.')
}
