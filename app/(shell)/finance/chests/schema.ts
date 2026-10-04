import { z } from 'zod'

import { ChestType } from '@/app/generated/prisma/enums'
import { isFinanceRuleError } from '@/domain/finance/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

export const chestSchema = z.object({
  name: requiredText('Enter a chest name.', 40),
  type: z.enum(ChestType, { error: 'Choose a type.' }),
  // From a date input: "2026-12-31", or empty for no lock.
  lockedUntil: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')
    .optional(),
})

export const deleteChestSchema = z.object({
  chestId: z.string({ error: 'Choose a chest.' }).trim().min(1, 'Choose a chest.'),
})

// 0 is Sunday, 6 is Saturday.
export const sweepDaySchema = z.object({
  day: z
    .string({ error: 'Choose a day.' })
    .regex(/^[0-6]$/, 'Choose a day.')
    .transform(Number),
})

export const sweepDayForm = new FormHandler(sweepDaySchema, { isRuleError: isFinanceRuleError })
export const chestForm = new FormHandler(chestSchema, { isRuleError: isFinanceRuleError })
export const deleteChestForm = new FormHandler(deleteChestSchema, { isRuleError: isFinanceRuleError })
