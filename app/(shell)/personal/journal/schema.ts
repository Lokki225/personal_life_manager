import { z } from 'zod'

import { isPersonalRuleError } from '@/domain/personal/errors'
import { JOURNAL_TYPES } from '@/domain/personal/journal'
import { FormHandler } from '@/lib/forms/FormHandler'

const options = { isRuleError: isPersonalRuleError }

const scale = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : null))
  .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 5), 'Choose from 1 to 5.')

const day = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), message)
    .transform((value) => {
      if (!value) return null
      const [y, m, d] = value.split('-').map(Number)
      return new Date(y, m - 1, d)
    })

export const entrySchema = z.object({
  id: z.string().trim().optional(),
  type: z.enum(JOURNAL_TYPES, { error: 'Choose a kind of entry.' }).default('FREE'),
  title: z.string().trim().max(80, 'Keep it under 80 characters.').optional(),
  body: z.string({ error: 'Write something first.' }).trim().min(1, 'Write something first.').max(10_000, 'Keep it under 10,000 characters.'),
  mood: scale,
  energy: scale,
  entryDate: day('Choose a date.'),
  reviewOn: day('Choose a date.'),
  secure: z.string().optional(),
  password: z.string().optional(),
})

export const passwordSchema = z.object({
  id: z.string().trim().min(1),
  password: z.string({ error: 'Enter the password.' }).min(1, 'Enter the password.'),
})

export const entryForm = new FormHandler(entrySchema, options)
export const passwordForm = new FormHandler(passwordSchema, options)

export const dailyNoteForm = new FormHandler(
  z.object({ body: z.string({ error: 'Write something first.' }).trim().min(1, 'Write something first.').max(500, 'Keep it under 500 characters.') }),
  options,
)
