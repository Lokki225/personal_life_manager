import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FEEDBACK_KINDS, MAX_FEEDBACK_LENGTH } from '@/application/account/feedback'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

export const feedbackSchema = z.object({
  // Empty when no star was chosen.
  rating: z
    .string()
    .regex(/^[1-5]?$/, 'Choose from 1 to 5 stars.')
    .optional()
    .transform((value) => (value ? Number(value) : null)),
  kind: z.enum(FEEDBACK_KINDS, { error: 'Choose what it is about.' }),
  message: requiredText('Write a few words.', MAX_FEEDBACK_LENGTH),
  // A checkbox: "on" when ticked, absent otherwise.
  wantsNews: z
    .string()
    .optional()
    .transform((value) => value === 'on'),
})

export const feedbackForm = new FormHandler(feedbackSchema, { isRuleError: isAccountRuleError })
