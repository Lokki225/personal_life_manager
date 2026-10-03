import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'

export const notesSchema = z.object({
  enabled: z.enum(['true', 'false'], { error: 'Choose on or off.' }).transform((value) => value === 'true'),
})

// A conversation as the page sends it.
export const conversationSchema = z
  .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(10_000) }))
  .max(200)

export const notesForm = new FormHandler(notesSchema, { isRuleError: isAccountRuleError })
