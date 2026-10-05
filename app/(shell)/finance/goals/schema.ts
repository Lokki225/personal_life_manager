import { z } from 'zod'

import { GoalLogic } from '@/app/generated/prisma/enums'

// Finance compares amounts and counts; choices (IN) belong to other nodes.
const FINANCE_OPERATORS = ['GTE', 'LTE', 'EQ', 'GT', 'LT'] as const
import { GOAL_MEASUREMENTS } from '@/application/finance/measurements'
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

const conditionSchema = z.object(
  {
    measurement: z.enum(GOAL_MEASUREMENTS, { error: 'Choose what to measure.' }),
    operator: z.enum(FINANCE_OPERATORS, { error: 'Choose a comparison.' }),
    // Zero is a valid target, e.g. "at most 0 exceptions".
    targetValue: z
      .string({ error: 'Enter a target.' })
      .trim()
      .regex(/^\d{1,12}$/, 'Enter a whole number.')
      .transform(Number),
    chestId: z.string().trim().optional(),
    category: z.string().trim().optional(),
  },
  { error: 'Fill in this condition.' },
)

export const customGoalSchema = z.object({
  name: requiredText('Enter a goal name.', 40),
  logic: z.enum(GoalLogic, { error: 'Choose how conditions combine.' }),
  conditions: z
    .array(conditionSchema, { error: 'Add at least one condition.' })
    .min(1, 'Add at least one condition.')
    .max(5, 'A goal can have up to 5 conditions.'),
})

export const goalForm = new FormHandler(goalSchema, options)
export const fundGoalForm = new FormHandler(fundGoalSchema, options)
export const customGoalForm = new FormHandler(customGoalSchema, options)
