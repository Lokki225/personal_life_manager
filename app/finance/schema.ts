import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField } from '@/lib/forms/fields'

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()

export const expenseSchema = z.object({
  amount: moneyField,
  category: z.enum(EXPENSE_CATEGORIES, { error: 'Choose a category.' }),
  description: optionalText(80),
})

export const saveRemainingSchema = z.object({
  amount: moneyField,
  destinationChestId: z.string().trim().optional(),
})

const chestId = (message: string) => z.string({ error: message }).trim().min(1, message)

export const transferSchema = z.object({
  sourceChestId: chestId('Choose where the money comes from.'),
  destinationChestId: chestId('Choose where the money goes.'),
  amount: moneyField,
})

export const exceptionSchema = z.object({
  category: z.enum(EXCEPTION_CATEGORIES, { error: 'Choose a category.' }),
  reason: optionalText(160),
})

const options = { isRuleError: isFinanceRuleError }

export const expenseForm = new FormHandler(expenseSchema, options)
export const saveRemainingForm = new FormHandler(saveRemainingSchema, options)
export const exceptionForm = new FormHandler(exceptionSchema, options)
export const transferForm = new FormHandler(transferSchema, options)
export const consolidateForm = new FormHandler(z.object({}), options)
