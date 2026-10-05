import type { GoalStatus } from '@/domain/goals/status'
import { m } from '@/lib/i18n/translate'

// Plain-language names for Personal goals. English: pass them through the
// translator before showing them.

export const STATUS_LABELS: Record<GoalStatus, string> = {
  NOT_STARTED: m('Not started'),
  IN_PROGRESS: m('In progress'),
  ON_TRACK: m('On track'),
  BEHIND: m('Behind'),
  CRITERIA_MET: m('Criteria met'),
  ACHIEVED: m('Achieved'),
  MAINTAINING: m('Holding'),
  LAPSED: m('Slipping'),
  EXPIRED: m('Past its date'),
  PAUSED: m('Paused'),
  ABANDONED: m('Abandoned'),
  SUPERSEDED: m('Replaced'),
}

// Good news in green, everything else neutral: status colours are never red
// for a goal, which is never a failure.
export const statusTone = (status: GoalStatus) =>
  status === 'ACHIEVED' || status === 'CRITERIA_MET' || status === 'MAINTAINING' || status === 'ON_TRACK' ? 'success' : 'neutral'

export const PRESET_LABELS = {
  outcome: m('A level to reach'),
  accumulation: m('Time to put in'),
  milestones: m('Steps to go through'),
  habit: m('A habit to keep'),
  checklist: m('A list to finish'),
} as const

export const PRESET_HINTS = {
  outcome: m('A rating, a score, a weight: reached when the latest value gets there.'),
  accumulation: m('Hours of sessions since you start, for example 150 hours of Japanese.'),
  milestones: m('Named steps in order; done when every step is done.'),
  habit: m('So many times a week, for as long as you keep it.'),
  checklist: m('Tasks to tick; done when all of them are.'),
} as const

export const HORIZON_LABELS = {
  WEEK: m('This week'),
  QUARTER: m('This quarter'),
  YEAR: m('This year'),
  SOMEDAY: m('Someday'),
} as const

export const TIER_LABELS = {
  below: m('below the floor'),
  floor: m('floor met'),
  target: m('target met'),
  stretch: m('stretch met'),
} as const

export const TIME_CONTROL_LABELS = {
  rapid: m('Rapid'),
  blitz: m('Blitz'),
  bullet: m('Bullet'),
  daily: m('Daily'),
} as const
