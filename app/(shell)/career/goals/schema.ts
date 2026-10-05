import { z } from 'zod'

import { CHOICE_DIMENSIONS, LEVELS, NUMBER_DIMENSIONS, type Criterion } from '@/domain/career/criteria'
import { isCareerRuleError } from '@/domain/career/errors'
import { FACT_KINDS } from '@/domain/career/situation'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isCareerRuleError }

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()
const id = z.string().trim().min(1)

export const goalSchema = z.object({
  id: z.string().trim().optional(),
  name: requiredText('Say what you want.', 120),
  why: text(1000),
  deadline: z.union([z.literal(''), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')]).optional(),
  importance: z.union([z.literal(''), z.enum(['LOW', 'MEDIUM', 'HIGH'])]).optional(),
})

export const criterionSchema = z
  .object({
    goalId: id,
    kind: z.enum(['number', 'choice', 'evidence', 'judgement'], { error: 'Choose a kind of criterion.' }),
    level: z.enum(LEVELS, { error: 'Choose how much it counts.' }).default('REQUIRED'),
    numberDimension: z.enum(NUMBER_DIMENSIONS).optional(),
    operator: z.enum(['GTE', 'LTE', 'EQ']).optional(),
    target: z.string().trim().optional(),
    choiceDimension: z.enum(CHOICE_DIMENSIONS).optional(),
    // One checkbox per accepted value: accepted.<value> = "on".
    accepted: z.record(z.string(), z.string()).optional(),
    factKind: z.enum(FACT_KINDS).optional(),
    match: text(120),
    label: text(160),
  })
  .superRefine((form, context) => {
    if (form.kind === 'number' && !/^\d{1,12}$/.test(form.target ?? '')) {
      context.addIssue({ code: 'custom', path: ['target'], message: 'Enter a number, digits only.' })
    }
  })

// The criterion the form describes. Values are checked again by the domain.
export function criterionFrom(form: z.output<typeof criterionSchema>): Criterion {
  switch (form.kind) {
    case 'number':
      return { kind: 'number', level: form.level, dimension: form.numberDimension ?? 'monthly_compensation', operator: form.operator ?? 'GTE', target: Number(form.target) }
    case 'choice':
      return { kind: 'choice', level: form.level, dimension: form.choiceDimension ?? 'work_arrangement', accepted: Object.keys(form.accepted ?? {}) }
    case 'evidence':
      return { kind: 'evidence', level: form.level, factKind: form.factKind ?? 'SKILL', match: form.match ?? '' }
    case 'judgement':
      return { kind: 'judgement', level: form.level, label: form.label ?? '' }
  }
}

export const judgeSchema = z.object({
  conditionId: id,
  result: z.enum(['MET', 'GAP', 'UNKNOWN'], { error: 'Choose your verdict.' }),
  note: text(280),
})

export const abandonSchema = z.object({ id, reason: text(280) })
export const supersedeSchema = z.object({ id, byId: z.string({ error: 'Choose the goal that replaces it.' }).trim().min(1, 'Choose the goal that replaces it.') })

export const goalForm = new FormHandler(goalSchema, options)
export const criterionForm = new FormHandler(criterionSchema, options)
export const judgeForm = new FormHandler(judgeSchema, options)
export const abandonForm = new FormHandler(abandonSchema, options)
export const supersedeForm = new FormHandler(supersedeSchema, options)
