import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { MAX_INSTRUCTIONS_LENGTH, MAX_NAME_LENGTH } from '@/application/assistant/persona'
import { FormHandler } from '@/lib/forms/FormHandler'

export const USER_ROLES = ['USER', 'ADMIN'] as const

export const roleSchema = z.object({
  userId: z.string({ error: 'Choose a user.' }).trim().min(1, 'Choose a user.'),
  role: z.enum(USER_ROLES, { error: 'Choose a role.' }),
})

export const roleForm = new FormHandler(roleSchema, { isRuleError: isAccountRuleError })

// The assistant of the whole app. An empty role means the default one.
export const appPersonaSchema = z.object({
  name: z.string().trim().max(MAX_NAME_LENGTH, `Keep it under ${MAX_NAME_LENGTH} characters.`).optional(),
  role: z
    .string()
    .trim()
    .max(MAX_INSTRUCTIONS_LENGTH, `Keep it under ${MAX_INSTRUCTIONS_LENGTH} characters.`)
    .optional(),
  // A checkbox: "on" when ticked, absent otherwise.
  personalAllowed: z
    .string()
    .optional()
    .transform((value) => value === 'on'),
})

export const appPersonaForm = new FormHandler(appPersonaSchema, { isRuleError: isAccountRuleError })
