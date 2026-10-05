import { z } from 'zod'

import { isCareerRuleError } from '@/domain/career/errors'
import { CONTRACT_TYPES, FACT_KINDS, WORK_ARRANGEMENTS, type FactInput } from '@/domain/career/situation'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isCareerRuleError }

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()
const isoDay = /^\d{4}-\d{2}-\d{2}$/
const date = (message: string) => z.string({ error: message }).trim().regex(isoDay, message)
const optionalDate = z.union([z.literal(''), z.string().trim().regex(isoDay, 'Choose a date.')]).optional()
const wholeNumber = (pattern: RegExp, message: string) => z.union([z.literal(''), z.string().trim().regex(pattern, message)]).optional()

// "2026-10-05" as midnight that day, on the person's clock.
export const dayOf = (value: string | undefined) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const numberOf = (value: string | undefined) => (value ? Number(value) : null)

export const factSchema = z.object({
  id: z.string().trim().optional(),
  kind: z.enum(FACT_KINDS, { error: 'Choose what it is.' }),
  title: requiredText('Give it a title.', 120),
  details: text(1000),
  validFrom: date('Choose when it started.'),
  validTo: optionalDate,
  primary: z.string().optional(),
  confirmed: z.string().optional(),
  organisation: text(120),
  monthlyCompensation: wholeNumber(/^\d{1,12}$/, 'Use digits only, for example 450000.'),
  workArrangement: z.union([z.literal(''), z.enum(WORK_ARRANGEMENTS)]).optional(),
  contractType: z.union([z.literal(''), z.enum(CONTRACT_TYPES)]).optional(),
  weeklyHours: wholeNumber(/^\d{1,3}$/, 'Enter between 0 and 168 hours.'),
  location: text(60),
  issuer: text(120),
  obtainedAt: optionalDate,
  expiresAt: optionalDate,
  level: text(60),
  positionId: z.string().trim().optional(),
})

export type FactFormData = z.output<typeof factSchema>

// The fact the form describes, in the domain's shape.
export function factInputFrom(form: FactFormData): FactInput {
  return {
    kind: form.kind,
    title: form.title,
    details: form.details || null,
    validFrom: dayOf(form.validFrom)!,
    validTo: dayOf(form.validTo),
    organisation: form.organisation || null,
    monthlyCompensation: numberOf(form.monthlyCompensation),
    workArrangement: form.workArrangement || null,
    contractType: form.contractType || null,
    weeklyHours: numberOf(form.weeklyHours),
    location: form.location || null,
    issuer: form.issuer || null,
    obtainedAt: dayOf(form.obtainedAt),
    expiresAt: dayOf(form.expiresAt),
    level: form.level || null,
    positionId: form.positionId || null,
  }
}

export const endFactSchema = z.object({
  id: z.string().trim().min(1),
  validTo: date('Choose when it ended.'),
})

export const evidenceSchema = z.object({
  title: requiredText('Give it a title.', 120),
  url: text(2000),
  description: text(1000),
  // One checkbox per fact: facts.<id> = "on".
  facts: z.record(z.string(), z.string()).optional(),
})

export const locationsSchema = z.object({
  // One place per line.
  places: z.string().max(2000, 'Keep the list shorter.').optional(),
})

export const factForm = new FormHandler(factSchema, options)
export const endFactForm = new FormHandler(endFactSchema, options)
export const evidenceForm = new FormHandler(evidenceSchema, options)
export const locationsForm = new FormHandler(locationsSchema, options)
