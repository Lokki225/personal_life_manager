import { z } from 'zod'

import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'

import { amountField } from '../../api'

const category = z.enum(EXPENSE_CATEGORIES, {
  error: `Use one of these for "category": ${EXPENSE_CATEGORIES.join(', ')}.`,
})
const description = z.string().trim().max(80, 'Keep the description under 80 characters.')

export const newExpense = z.object(
  {
    amount: amountField,
    category,
    description: description.optional(),
    // Only used when the expense goes beyond what is left today: why it did.
    cause: z
      .enum(EXCEPTION_CATEGORIES, { error: `Use one of these for "cause": ${EXCEPTION_CATEGORIES.join(', ')}.` })
      .optional(),
    reason: z.string().trim().max(160, 'Keep the reason under 160 characters.').optional(),
  },
  { error: 'Send the expense as a JSON object.' },
)

// Any of the three; what is left out stays as it was.
export const expenseChange = z
  .object({ amount: amountField.optional(), category: category.optional(), description: description.nullable().optional() })
  .refine((change) => Object.values(change).some((value) => value !== undefined), {
    error: 'Give at least one of "amount", "category" or "description".',
  })
