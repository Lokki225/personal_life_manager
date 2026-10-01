import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField, requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isFinanceRuleError }

export const goalSchema = z.object({
  name: requiredText('Enter what you are saving for.', 40),
  targetAmount: moneyField,
  // Empty means nothing put aside yet.
  alreadySaved: z
    .string()
    .trim()
    .regex(/^\d{0,12}$/, 'Use digits only, for example 8000.')
    .transform((value) => Number(value || 0))
    .optional(),
})

export const fundGoalSchema = z.object({
  goalId: z.string({ error: 'Choose a goal.' }).trim().min(1, 'Choose a goal.'),
  sourceChestId: z
    .string({ error: 'Choose where the money comes from.' })
    .trim()
    .min(1, 'Choose where the money comes from.'),
  amount: moneyField,
})

export const goalForm = new FormHandler(goalSchema, options)
export const fundGoalForm = new FormHandler(fundGoalSchema, options)
