import { z } from 'zod'

import { isLifeAreaRuleError } from '@/domain/lifeAreas/areas'
import { isProjectRuleError, MAX_LINKS, PROJECT_DOMAINS, PROJECT_KINDS, PROJECT_STATUSES } from '@/domain/projects/projects'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: (error: unknown) => isProjectRuleError(error) || isLifeAreaRuleError(error) }
const isoDay = /^\d{4}-\d{2}-\d{2}$/

export const projectSchema = z.object({
  id: z.string().trim().optional(),
  name: requiredText('Name the project.', 80),
  summary: z.string().trim().max(300, 'Keep it to one or two sentences.').optional(),
  kind: z.enum(PROJECT_KINDS, { error: 'Choose what kind of work it is.' }).default('OTHER'),
  primaryDomain: z.enum(PROJECT_DOMAINS, { error: 'Choose Personal or Career.' }).default('personal'),
  lifeAreaId: z.string().trim().optional(),
  startedAt: z.union([z.literal(''), z.string().trim().regex(isoDay, 'Choose a date.')]).optional(),
  planning: z.string().optional(),
  // Links as rows: links.0.label, links.0.url…
  links: z.array(z.object({ label: z.string().optional(), url: z.string().optional() })).max(MAX_LINKS).optional(),
})

export const moveSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(PROJECT_STATUSES, { error: 'Choose a status.' }),
  reason: z.string().trim().max(280, 'Keep it under 280 characters.').optional(),
})

export const projectForm = new FormHandler(projectSchema, options)
export const moveForm = new FormHandler(moveSchema, options)
