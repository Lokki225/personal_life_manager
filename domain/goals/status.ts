// A goal's status, derived from its evaluation (mechanism doc §4.2). Set by
// hand: abandoned, paused, superseded, and achieved for a goal that asks for
// confirmation.

export type GoalStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'ON_TRACK'
  | 'BEHIND'
  | 'CRITERIA_MET'
  | 'ACHIEVED'
  | 'MAINTAINING'
  | 'LAPSED'
  | 'EXPIRED'
  | 'PAUSED'
  | 'ABANDONED'
  | 'SUPERSEDED'

// AUTO: achieved as soon as the required conditions hold. CONFIRM: the app
// says the criteria are met and the person confirms.
export type AchievementMode = 'AUTO' | 'CONFIRM'

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
  // Absent on goals from before these existed: AUTO, never paused or replaced.
  achievementMode?: AchievementMode
  pausedAt?: Date | null
  supersededAt?: Date | null
}

export function deriveStatus(goal: StatusInput, now: Date): GoalStatus {
  const mode = goal.achievementMode ?? 'AUTO'
  if (goal.abandonedAt) return 'ABANDONED'
  if (goal.supersededAt) return 'SUPERSEDED'

  // A confirmed goal stays achieved; an automatic one when it latches.
  const confirmed = goal.achievedAt !== null && (goal.latch || mode === 'CONFIRM')
  if (goal.lifecycle === 'TERMINAL' && (confirmed || (goal.satisfied && mode === 'AUTO'))) return 'ACHIEVED'
  if (goal.pausedAt) return 'PAUSED'

  if (goal.lifecycle !== 'TERMINAL') {
    if (goal.satisfied) return 'MAINTAINING'
    return goal.hasEvidence ? 'LAPSED' : 'NOT_STARTED'
  }

  if (goal.satisfied) return 'CRITERIA_MET'
  if (goal.deadline && goal.deadline < now) return 'EXPIRED'
  if (!goal.hasEvidence) return 'NOT_STARTED'
  if (goal.deadline && goal.projected) return goal.projected <= goal.deadline ? 'ON_TRACK' : 'BEHIND'
  if (goal.healthy !== null) return goal.healthy ? 'ON_TRACK' : 'BEHIND'
  return 'IN_PROGRESS'
}

// Whether to record the moment a goal was first achieved: once, for a goal
// that latches and does not wait for the person to confirm.
export const shouldStampAchieved = (
  goal: Pick<StatusInput, 'lifecycle' | 'latch' | 'achievedAt' | 'abandonedAt' | 'satisfied' | 'achievementMode' | 'supersededAt'>,
) =>
  goal.lifecycle === 'TERMINAL' &&
  goal.latch &&
  (goal.achievementMode ?? 'AUTO') === 'AUTO' &&
  !goal.achievedAt &&
  !goal.abandonedAt &&
  !goal.supersededAt &&
  goal.satisfied
