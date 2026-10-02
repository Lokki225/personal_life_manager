import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import { DEBT_DIRECTIONS, INTEREST_TYPES } from '@/domain/finance/options'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField, requiredText } from '@/lib/forms/fields'

const requiredId = (message: string) => z.string({ error: message }).trim().min(1, message)

export const debtSchema = z.object({
  direction: z.enum(DEBT_DIRECTIONS, { error: 'Choose borrowed or lent.' }),
  counterparty: requiredText('Enter a name.', 60),
  amount: moneyField,
  interestType: z.enum(INTEREST_TYPES, { error: 'Choose an interest type.' }),
  // A percentage or an amount, depending on the type. Empty for no interest.
  interestValue: z
    .string()
    .trim()
    .regex(/^(\d{1,12}(\.\d{1,2})?)?$/, 'Use digits only, for example 5.')
    .optional(),
  // Where money lent comes from. Money borrowed always goes to the Debts Chest.
  chestId: z.string().trim().optional(),
  // The goal money was borrowed for, or empty.
  goalId: z.string().trim().optional(),
  // From a date input: "2026-12-31", or empty for no due date.
  dueDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')
    .optional(),
})

export const repaySchema = z.object({
  debtId: requiredId('Choose a debt.'),
  amount: moneyField,
  // Where a repayment of borrowed money comes from.
  chestId: z.string().trim().optional(),
})

const options = { isRuleError: isFinanceRuleError }

export const debtForm = new FormHandler(debtSchema, options)
export const repayForm = new FormHandler(repaySchema, options)
