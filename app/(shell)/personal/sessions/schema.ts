import { z } from 'zod'

import { isPersonalRuleError } from '@/domain/personal/errors'
import { FormHandler } from '@/lib/forms/FormHandler'

export const logSessionForm = new FormHandler(
  z.object({
    minutes: z
      .string({ error: 'Enter between 1 and 960 minutes.' })
      .trim()
      .regex(/^\d{1,3}$/, 'Enter between 1 and 960 minutes.')
      .transform(Number)
      .refine((minutes) => minutes >= 1 && minutes <= 960, 'Enter between 1 and 960 minutes.'),
    goalId: z.string().trim().optional(),
    note: z.string().trim().max(200, 'Keep it under 200 characters.').optional(),
  }),
  { isRuleError: isPersonalRuleError },
)
