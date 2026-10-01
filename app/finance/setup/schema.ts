import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import { ALLOCATION_CATEGORIES, ALLOCATION_PERIODS, INCOME_FREQUENCIES } from '@/domain/finance/options'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField, requiredText } from '@/lib/forms/fields'

const allocationSchema = z.object(
  {
    name: requiredText('Enter an allocation name.'),
    amount: moneyField,
    period: z.enum(ALLOCATION_PERIODS, { error: 'Choose a period.' }),
    category: z.enum(ALLOCATION_CATEGORIES, { error: 'Choose a category.' }),
  },
  // Shown when a whole row is missing, e.g. indexes 0 and 2 posted without 1.
  { error: 'Fill in this allocation.' },
)

export const setupPlanSchema = z.object({
  incomeSource: requiredText('Enter an income source.'),
  incomeAmount: moneyField,
  incomeFrequency: z.enum(INCOME_FREQUENCIES, { error: 'Choose a frequency.' }),
  allocations: z
    .array(allocationSchema, { error: 'Add at least one allocation.' })
    .min(1, 'Add at least one allocation.')
    .max(50, 'That is too many allocations.'),
})

export type SetupPlan = z.output<typeof setupPlanSchema>

export const setupForm = new FormHandler(setupPlanSchema, { isRuleError: isFinanceRuleError })
