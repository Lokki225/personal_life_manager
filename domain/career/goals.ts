import { evaluateGroup, summarize, type ConditionGroup, type ConditionResult, type Subject, SELF } from '../goals/engine'
import { careerResolver, type CareerEvidence } from '../goals/careerSources'
import { deriveStatus, type GoalStatus } from '../goals/status'

// A Career goal (Career spec §5): one ALL group of criteria, achieved when the
// person confirms it once the required ones are met.

export type CareerGoalTree = {
  id: string
  startDate: Date
  deadline: Date | null
  achievedAt: Date | null
  abandonedAt: Date | null
  pausedAt: Date | null
  supersededAt: Date | null
  group: ConditionGroup
}

export type CareerGoalEvaluation = {
  status: GoalStatus
  satisfied: boolean
  results: ConditionResult[]
  summary: ReturnType<typeof summarize>
}

export function evaluateCareerGoal(goal: CareerGoalTree, evidence: CareerEvidence, now: Date, subject: Subject = SELF): CareerGoalEvaluation {
  const evaluation = evaluateGroup(goal.group, careerResolver(evidence, now), now, goal.startDate, subject)
  const status = deriveStatus(
    {
      lifecycle: 'TERMINAL',
      latch: true,
      achievementMode: 'CONFIRM',
      achievedAt: goal.achievedAt,
      abandonedAt: goal.abandonedAt,
      pausedAt: goal.pausedAt,
      supersededAt: goal.supersededAt,
      deadline: goal.deadline,
      // A goal with no criteria yet decides nothing.
      satisfied: goal.group.conditions.length > 0 && evaluation.satisfied,
      hasEvidence: evaluation.results.some((r) => r.result !== 'UNKNOWN'),
      projected: null,
      healthy: null,
    },
    now,
  )

  return { status, satisfied: evaluation.satisfied, results: evaluation.results, summary: summarize(evaluation.results) }
}

// Active goals first (the spec lists them first, no limit), then the rest.
const CLOSED: GoalStatus[] = ['ACHIEVED', 'ABANDONED', 'SUPERSEDED']
export const isClosed = (status: GoalStatus) => CLOSED.includes(status)
