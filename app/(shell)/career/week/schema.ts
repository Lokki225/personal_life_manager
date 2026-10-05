import { z } from 'zod'

import type { LogAlso } from '@/application/career/log'
import { isCareerRuleError } from '@/domain/career/errors'
import { OPPORTUNITY_STATUSES, OUTCOMES } from '@/domain/career/opportunities'
import { FACT_KINDS } from '@/domain/career/situation'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isCareerRuleError }

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()
const optionalId = z.string().trim().optional()

export const focusSchema = z.object({
  title: requiredText('Say what you will do.', 120),
  goalId: optionalId,
  opportunityId: optionalId,
})

export const LOG_ALSO = ['none', 'newFact', 'endFact', 'evidence', 'move'] as const

export const logSchema = z
  .object({
    body: requiredText('Write a line first.', 500),
    goalId: optionalId,
    opportunityId: optionalId,
    also: z.enum(LOG_ALSO).default('none'),
    factKind: z.enum(FACT_KINDS).optional(),
    factTitle: text(120),
    factId: optionalId,
    evidenceTitle: text(120),
    evidenceUrl: text(2000),
    moveOpportunityId: optionalId,
    status: z.enum(OPPORTUNITY_STATUSES).optional(),
    outcome: z.union([z.literal(''), z.enum(OUTCOMES)]).optional(),
  })
  .superRefine((form, context) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) context.addIssue({ code: 'custom', path: [path], message })
    }
    if (form.also === 'newFact') need(Boolean(form.factTitle), 'factTitle', 'Give it a title.')
    if (form.also === 'endFact' || form.also === 'evidence') need(Boolean(form.factId), 'factId', 'Choose a fact.')
    if (form.also === 'evidence') need(Boolean(form.evidenceTitle), 'evidenceTitle', 'Give it a title.')
    if (form.also === 'move') {
      need(Boolean(form.moveOpportunityId), 'moveOpportunityId', 'Choose an opportunity.')
      need(Boolean(form.status), 'status', 'Choose a status.')
    }
  })

// What the log line also records, from the form.
export function alsoFrom(form: z.output<typeof logSchema>): LogAlso {
  switch (form.also) {
    case 'newFact':
      return { kind: 'newFact', factKind: form.factKind ?? 'SKILL', title: form.factTitle ?? '' }
    case 'endFact':
      return { kind: 'endFact', factId: form.factId ?? '' }
    case 'evidence':
      return { kind: 'evidence', factId: form.factId ?? '', title: form.evidenceTitle ?? '', url: form.evidenceUrl || null }
    case 'move':
      return { kind: 'move', opportunityId: form.moveOpportunityId ?? '', status: form.status ?? 'APPLIED', outcome: form.outcome || null }
    default:
      return { kind: 'none' }
  }
}

export const focusForm = new FormHandler(focusSchema, options)
export const logForm = new FormHandler(logSchema, options)
