import { z } from 'zod'

import { isCareerRuleError } from '@/domain/career/errors'
import { OPPORTUNITY_KINDS, OPPORTUNITY_STATUSES, OUTCOMES, type OpportunityInput } from '@/domain/career/opportunities'
import { CONTRACT_TYPES, WORK_ARRANGEMENTS } from '@/domain/career/situation'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

import { dayOf } from '../situation/schema'

const options = { isRuleError: isCareerRuleError }

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()
const optionalDate = z.union([z.literal(''), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')]).optional()
const wholeNumber = (pattern: RegExp, message: string) => z.union([z.literal(''), z.string().trim().regex(pattern, message)]).optional()
const id = z.string().trim().min(1)
// One checkbox per goal: goals.<id> = "on".
const goals = z.record(z.string(), z.string()).optional()

export const opportunitySchema = z.object({
  id: z.string().trim().optional(),
  title: requiredText('Give it a title.', 120),
  organisation: text(120),
  kind: z.enum(OPPORTUNITY_KINDS, { error: 'Choose what it is.' }).default('JOB'),
  sourceUrl: text(2000),
  notes: text(2000),
  deadline: optionalDate,
  monthlyCompensation: wholeNumber(/^\d{1,12}$/, 'Use digits only, for example 450000.'),
  workArrangement: z.union([z.literal(''), z.enum(WORK_ARRANGEMENTS)]).optional(),
  contractType: z.union([z.literal(''), z.enum(CONTRACT_TYPES)]).optional(),
  weeklyHours: wholeNumber(/^\d{1,3}$/, 'Enter between 0 and 168 hours.'),
  location: text(60),
  goals,
})

export function opportunityInputFrom(form: z.output<typeof opportunitySchema>): OpportunityInput {
  return {
    title: form.title,
    organisation: form.organisation || null,
    kind: form.kind,
    sourceUrl: form.sourceUrl || null,
    notes: form.notes || null,
    deadline: dayOf(form.deadline),
    monthlyCompensation: form.monthlyCompensation ? Number(form.monthlyCompensation) : null,
    workArrangement: form.workArrangement || null,
    contractType: form.contractType || null,
    weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null,
    location: form.location || null,
  }
}

export const statusSchema = z.object({
  id,
  status: z.enum(OPPORTUNITY_STATUSES, { error: 'Choose a status.' }),
  outcome: z.union([z.literal(''), z.enum(OUTCOMES)]).optional(),
})

export const linkGoalsSchema = z.object({ id, goals })

export const acceptSchema = z.object({
  id,
  createPosition: z.string().optional(),
  startsOn: z.string({ error: 'Choose when it starts.' }).trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose when it starts.'),
  endCurrent: z.string().optional(),
  incomeId: z.string().trim().optional(),
  copyJudgements: z.string().optional(),
})

export const opportunityForm = new FormHandler(opportunitySchema, options)
export const statusForm = new FormHandler(statusSchema, options)
export const linkGoalsForm = new FormHandler(linkGoalsSchema, options)
export const acceptForm = new FormHandler(acceptSchema, options)
