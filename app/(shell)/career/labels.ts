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
