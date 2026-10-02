import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import {
  ALLOCATION_CATEGORIES,
  ALLOCATION_PERIODS,
  EXCEPTION_CATEGORIES,
  EXPENSE_CATEGORIES,
} from '@/domain/finance/options'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField, requiredText } from '@/lib/forms/fields'

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()

export const expenseSchema = z.object({
  amount: moneyField,
  category: z.enum(EXPENSE_CATEGORIES, { error: 'Choose a category.' }),
  description: optionalText(80),
  // Asked when the expense is larger than what is left of the day.
  cause: z.enum(EXCEPTION_CATEGORIES, { error: 'Choose a category.' }).optional(),
  reason: optionalText(160),
})

export const saveRemainingSchema = z.object({
  amount: moneyField,
  destinationChestId: z.string().trim().optional(),
})

const requiredId = (message: string) => z.string({ error: message }).trim().min(1, message)

export const transferSchema = z.object({
  sourceChestId: requiredId('Choose where the money comes from.'),
  destinationChestId: requiredId('Choose where the money goes.'),
  amount: moneyField,
})

export const confirmIncomeSchema = z.object({
  incomeId: requiredId('Choose an income.'),
  amount: moneyField,
})

const payDayField = z
  .string({ error: 'Enter a day from 1 to 31.' })
  .trim()
  .regex(/^([1-9]|[12]\d|3[01])$/, 'Enter a day from 1 to 31.')
  .transform(Number)

export const editExpenseSchema = z.object({
  id: requiredId('Choose an expense.'),
  amount: moneyField,
  category: z.enum(EXPENSE_CATEGORIES, { error: 'Choose a category.' }),
  description: optionalText(80),
})

export const deleteExpenseSchema = z.object({
  id: requiredId('Choose an expense.'),
})

export const incomeSchema = z.object({
  // Empty for a new income.
  id: z.string().trim().optional(),
  source: requiredText('Enter an income source.', 60),
  amount: moneyField,
  payDay: payDayField,
})

export const deleteIncomeSchema = z.object({
  id: requiredId('Choose an income.'),
})

export const planAllocationSchema = z.object({
  // Empty for a new allocation.
  id: z.string().trim().optional(),
  name: requiredText('Enter an allocation name.', 60),
  amount: moneyField,
  period: z.enum(ALLOCATION_PERIODS, { error: 'Choose a period.' }),
  category: z.enum(ALLOCATION_CATEGORIES, { error: 'Choose a category.' }),
})

export const deleteAllocationSchema = z.object({
  id: requiredId('Choose an allocation.'),
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
export const confirmIncomeForm = new FormHandler(confirmIncomeSchema, options)
export const planAllocationForm = new FormHandler(planAllocationSchema, options)
export const editExpenseForm = new FormHandler(editExpenseSchema, options)
export const deleteExpenseForm = new FormHandler(deleteExpenseSchema, options)
export const incomeForm = new FormHandler(incomeSchema, options)
export const deleteIncomeForm = new FormHandler(deleteIncomeSchema, options)
export const coverForm = new FormHandler(z.object({}), options)
export const deleteAllocationForm = new FormHandler(deleteAllocationSchema, options)
export const consolidateForm = new FormHandler(z.object({}), options)
