import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { MAX_INSTRUCTIONS_LENGTH, MAX_NAME_LENGTH } from '@/application/assistant/persona'
import { PROVIDER_IDS } from '@/infrastructure/ai/providers'
import { FormHandler } from '@/lib/forms/FormHandler'

export const providerSchema = z.object({
  provider: z.enum(PROVIDER_IDS, { error: 'Choose an AI.' }),
})

// What a person asks of their assistant. Both may be left empty.
export const personaSchema = z.object({
  name: z.string().trim().max(MAX_NAME_LENGTH, `Keep it under ${MAX_NAME_LENGTH} characters.`).optional(),
  instructions: z
    .string()
    .trim()
    .max(MAX_INSTRUCTIONS_LENGTH, `Keep it under ${MAX_INSTRUCTIONS_LENGTH} characters.`)
    .optional(),
})

// A conversation as the window sends it.
export const conversationSchema = z
  .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(10_000) }))
  .max(200)

export const personaForm = new FormHandler(personaSchema, { isRuleError: isAccountRuleError })
