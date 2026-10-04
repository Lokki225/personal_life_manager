// A goal's status, derived from its evaluation (mechanism doc §4.2). Only
// "abandoned" is ever set by hand.

export type GoalStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'ON_TRACK'
  | 'BEHIND'
  | 'ACHIEVED'
  | 'MAINTAINING'
  | 'LAPSED'
  | 'EXPIRED'
  | 'ABANDONED'

export type StatusInput = {
  lifecycle: 'TERMINAL' | 'ONGOING' | 'MAINTENANCE'
  latch: boolean
  achievedAt: Date | null
  abandonedAt: Date | null
  deadline: Date | null
  // The completion tree holds right now.
  satisfied: boolean
  // Some evidence exists (a session, a value, a ticked task...).
  hasEvidence: boolean
  // The projected date at the current pace, when it can be told.
  projected: Date | null
  // The health tree, when the goal has one.
  healthy: boolean | null
}

export function deriveStatus(goal: StatusInput, now: Date): GoalStatus {
  if (goal.abandonedAt) return 'ABANDONED'

  if (goal.lifecycle !== 'TERMINAL') {
    if (goal.satisfied) return 'MAINTAINING'
    return goal.hasEvidence ? 'LAPSED' : 'NOT_STARTED'
  }

  if ((goal.latch && goal.achievedAt) || goal.satisfied) return 'ACHIEVED'
  if (goal.deadline && goal.deadline < now) return 'EXPIRED'
  if (!goal.hasEvidence) return 'NOT_STARTED'
  if (goal.deadline && goal.projected) return goal.projected <= goal.deadline ? 'ON_TRACK' : 'BEHIND'
  if (goal.healthy !== null) return goal.healthy ? 'ON_TRACK' : 'BEHIND'
  return 'IN_PROGRESS'
}

// Whether to record the moment a goal was first achieved: once, for a goal
// that latches.
export const shouldStampAchieved = (goal: Pick<StatusInput, 'lifecycle' | 'latch' | 'achievedAt' | 'abandonedAt' | 'satisfied'>) =>
  goal.lifecycle === 'TERMINAL' && goal.latch && !goal.achievedAt && !goal.abandonedAt && goal.satisfied
