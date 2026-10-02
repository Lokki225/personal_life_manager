import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'

export const USER_ROLES = ['USER', 'ADMIN'] as const

export const roleSchema = z.object({
  userId: z.string({ error: 'Choose a user.' }).trim().min(1, 'Choose a user.'),
  role: z.enum(USER_ROLES, { error: 'Choose a role.' }),
})

export const roleForm = new FormHandler(roleSchema, { isRuleError: isAccountRuleError })
