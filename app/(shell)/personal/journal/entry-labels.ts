import { m } from '@/lib/i18n/translate'

export const ENTRY_TYPE_LABELS = {
  FREE: m('Free'),
  DAILY: m('Daily note'),
  DECISION: m('Decision'),
  IDEA: m('Idea'),
  REVIEW: m('Review'),
  CAREER_LOG: m('Career log'),
} as const

export const ENTRY_TYPE_HINTS = {
  FREE: m('Anything you want to write down.'),
  DAILY: m('A line or a few about the day.'),
  DECISION: m('What you decided, the context, what you expect. Look at it again later.'),
  IDEA: m('A quick thought, to come back to.'),
  REVIEW: m('A look back at a week or a month.'),
  CAREER_LOG: m('A line from the Career quick log.'),
} as const
