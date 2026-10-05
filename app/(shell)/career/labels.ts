import type { FactKind, FactSource } from '@/domain/career/situation'
import { m } from '@/lib/i18n/translate'

// Plain-language names for Career. English: pass them through the
// translator before showing them.

export const KIND_LABELS: Record<FactKind, string> = {
  POSITION: m('Position'),
  QUALIFICATION: m('Qualification'),
  SKILL: m('Skill'),
  EXPERIENCE: m('Experience'),
}

export const KIND_GROUP_LABELS: Record<FactKind, string> = {
  POSITION: m('Positions'),
  QUALIFICATION: m('Qualifications'),
  SKILL: m('Skills'),
  EXPERIENCE: m('Experience'),
}

export const KIND_HINTS: Record<FactKind, string> = {
  POSITION: m('A job or role you hold, with its terms.'),
  QUALIFICATION: m('A degree, a certificate, a licence.'),
  SKILL: m('Something you can do, at your own level.'),
  EXPERIENCE: m('Something you did or built, and how it went.'),
}

export const SOURCE_LABELS: Record<FactSource, string> = {
  SELF: m('Said by you'),
  DOCUMENTED: m('Documented'),
  CONFIRMED: m('Confirmed'),
}

export const ARRANGEMENT_LABELS: Record<string, string> = {
  on_site: m('On site'),
  hybrid: m('Hybrid'),
  remote: m('Remote'),
}

export const CONTRACT_LABELS: Record<string, string> = {
  permanent: m('Permanent'),
  fixed_term: m('Fixed term'),
  freelance: m('Freelance'),
  internship: m('Internship'),
  other: m('Other'),
}

// A date as the value of a date field.
export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const LEVEL_LABELS: Record<'REQUIRED' | 'PREFERRED' | 'INFO', string> = {
  REQUIRED: m('Required'),
  PREFERRED: m('Preferred'),
  INFO: m('Info'),
}

export const LEVEL_HINTS: Record<'REQUIRED' | 'PREFERRED' | 'INFO', string> = {
  REQUIRED: m('Decides whether the goal is reached.'),
  PREFERRED: m('Counted, but never blocks the goal.'),
  INFO: m('Shown, never counted as a gap.'),
}

export const RESULT_LABELS: Record<'MET' | 'EXCEEDS' | 'GAP' | 'UNKNOWN', string> = {
  MET: m('Met'),
  EXCEEDS: m('Exceeds'),
  GAP: m('Gap'),
  UNKNOWN: m('Unknown'),
}

export const CRITERION_KIND_LABELS = {
  number: m('A number'),
  choice: m('A choice'),
  evidence: m('A documented fact'),
  judgement: m('Your judgement'),
} as const

export const CRITERION_KIND_HINTS = {
  number: m('Pay or hours, compared with a target.'),
  choice: m('How you work, the contract, the place.'),
  evidence: m('A skill, a qualification or an experience, with evidence or confirmed.'),
  judgement: m('Something only you can say, such as "interesting work".'),
} as const

export const DIMENSION_LABELS: Record<string, string> = {
  monthly_compensation: m('Pay per month'),
  weekly_hours: m('Hours per week'),
  work_arrangement: m('How you work'),
  contract_type: m('Contract'),
  location: m('Place'),
}

export const OPERATOR_LABELS = {
  GTE: m('at least'),
  LTE: m('at most'),
  EQ: m('exactly'),
} as const

export const IMPORTANCE_LABELS = {
  LOW: m('Matters a little'),
  MEDIUM: m('Matters'),
  HIGH: m('Matters a lot'),
} as const
