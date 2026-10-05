import { evaluateGroup, inRange, pointsOf, windowRange, type ConditionGroup, type ConditionResult } from './engine'
import { paceKind, projectDate, tierOf } from './pace'
import { hasEvidence, personalResolver, type PersonalEvidence } from './personalSources'
import { deriveStatus, shouldStampAchieved, type AchievementMode, type GoalStatus } from './status'

// Evaluates a Personal goal: its milestones first (a milestone done stays
// done), then its completion and health trees, its pace and its status.

export type GoalTree = {
  id: string
  lifecycle: 'TERMINAL' | 'ONGOING' | 'MAINTENANCE'
  latch: boolean
  startDate: Date
  deadline: Date | null
  achievedAt: Date | null
  abandonedAt: Date | null
  achievementMode?: AchievementMode
  pausedAt?: Date | null
  supersededAt?: Date | null
  // The goal's root groups, completion and health.
  groups: ConditionGroup[]
  milestones: { id: string; name: string; order: number | null; completedAt: Date | null; groups: ConditionGroup[] }[]
}

export type MilestoneResult = { id: string; name: string; order: number | null; completedAt: Date | null; newlyCompleted: boolean }

export type GoalEvaluation = {
  status: GoalStatus
  satisfied: boolean
  completion: ConditionResult[]
  health: (ConditionResult & { tier: ReturnType<typeof tierOf> })[]
  milestones: MilestoneResult[]
  projected: Date | null
  // Things to record: milestones completed and the goal achieved, for the first time.
  stamp: { milestoneIds: string[]; achieved: boolean }
}

const combineRoots = (groups: ConditionGroup[], role: 'COMPLETION' | 'HEALTH'): ConditionGroup | null => {
  const roots = groups.filter((g) => g.role === role)
  if (roots.length === 0) return null
  return roots.length === 1 ? roots[0] : { id: role, logic: 'ALL', role, conditions: [], children: roots }
}

export function evaluatePersonalGoal(goal: GoalTree, evidence: PersonalEvidence, now: Date): GoalEvaluation {
  const milestones: MilestoneResult[] = [...goal.milestones]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((m) => {
      if (m.completedAt) return { ...m, newlyCompleted: false }

      const own = combineRoots(m.groups, 'COMPLETION')
      const tasks = evidence.tasks.filter((t) => t.milestoneId === m.id)
      // Without its own conditions, a milestone is done when all its tasks are.
      const done = own
        ? evaluateGroup(own, personalResolver(evidence, { goalId: goal.id, milestoneId: m.id }, now), now, goal.startDate).satisfied
        : tasks.length > 0 && tasks.every((t) => t.done)

      return { id: m.id, name: m.name, order: m.order, completedAt: done ? now : null, newlyCompleted: done }
    })

  const withMilestones: PersonalEvidence = {
    ...evidence,
    milestones: [
      ...evidence.milestones.filter((m) => m.goalId !== goal.id),
      ...milestones.map((m) => ({ id: m.id, goalId: goal.id, completedAt: m.completedAt })),
    ],
  }
  const resolve = personalResolver(withMilestones, { goalId: goal.id }, now)

  const completionGroup = combineRoots(goal.groups, 'COMPLETION')
  const healthGroup = combineRoots(goal.groups, 'HEALTH')
  const completion = completionGroup ? evaluateGroup(completionGroup, resolve, now, goal.startDate) : { satisfied: false, results: [] }
  const health = healthGroup ? evaluateGroup(healthGroup, resolve, now, goal.startDate) : null

  // Pace from the main completion condition, when the goal has a deadline.
  const main = completion.results[0]?.condition
  const kind = main ? paceKind(main.aggregation) : null
  const projected =
    main && kind && goal.deadline
      ? projectDate(inRange(pointsOf(resolve, main), windowRange(main.window, now, goal.startDate)), main.target, kind, goal.startDate, now)
      : null

  const seriesIds = goal.groups.flatMap((g) => g.conditions).flatMap((c) => (typeof c.sourceRef.seriesId === 'string' ? [c.sourceRef.seriesId] : []))
  const facts = {
    lifecycle: goal.lifecycle,
    latch: goal.latch,
    achievedAt: goal.achievedAt,
    abandonedAt: goal.abandonedAt,
    achievementMode: goal.achievementMode,
    pausedAt: goal.pausedAt ?? null,
    supersededAt: goal.supersededAt ?? null,
    deadline: goal.deadline,
    satisfied: completion.satisfied,
    hasEvidence: hasEvidence(withMilestones, goal.id, seriesIds),
    projected,
    healthy: health ? health.satisfied : null,
  }

  return {
    status: deriveStatus(facts, now),
    satisfied: completion.satisfied,
    completion: completion.results,
    health: (health?.results ?? []).map((r) => ({ ...r, tier: tierOf(r.actual, r.condition.target, r.condition.floor, r.condition.stretch) })),
    milestones,
    projected,
    stamp: { milestoneIds: milestones.filter((m) => m.newlyCompleted).map((m) => m.id), achieved: shouldStampAchieved(facts) },
  }
}
