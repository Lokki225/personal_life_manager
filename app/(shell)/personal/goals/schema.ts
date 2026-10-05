import { z } from 'zod'

import { HORIZONS, PRESETS } from '@/domain/goals/presets'
import { TIME_CONTROLS } from '@/domain/personal/chess'
import { isPersonalRuleError } from '@/domain/personal/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isPersonalRuleError }

// An optional number: empty is none; anything else must be a number.
const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return null
    const number = Number(value.replace(',', '.'))
    if (!Number.isFinite(number)) {
      context.addIssue({ code: 'custom', message: 'Enter a number.' })
      return z.NEVER
    }
    return number
  })

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      context.addIssue({ code: 'custom', message: 'Choose a date.' })
      return z.NEVER
    }
    const [y, m, d] = value.split('-').map(Number)
    // The end of that day, on the person's clock.
    return new Date(y, m - 1, d, 23, 59, 59)
  })

export const goalSchema = z.object({
  preset: z.enum(PRESETS, { error: 'Choose a kind of goal.' }),
  name: requiredText('Enter a goal name.', 60),
  horizon: z.enum(HORIZONS, { error: 'Choose a horizon.' }).default('QUARTER'),
  // Counts for the career: once reached, Career offers it as a skill.
  careerRelevant: z.string().optional(),
  deadline: optionalDate,
  categoryId: z.string().trim().optional(),
  // "new" creates a measure from seriesLabel and seriesUnit; "chess" follows a
  // chess.com rating.
  seriesId: z.string().trim().optional(),
  chessUsername: z.string().trim().max(25, 'Enter a chess.com username.').optional(),
  timeControl: z.enum(TIME_CONTROLS).default('rapid'),
  seriesLabel: z.string().trim().max(40, 'Keep it under 40 characters.').optional(),
  seriesUnit: z.string().trim().max(12, 'Keep it under 12 characters.').optional(),
  currentValue: optionalNumber,
  target: optionalNumber,
  // One step per line.
  milestones: z.string().optional(),
  counts: z.enum(['sessions', 'tasks']).default('sessions'),
  floor: optionalNumber,
  stretch: optionalNumber,
  weeklySessions: optionalNumber,
})

export const abandonSchema = z.object({
  goalId: z.string().trim().min(1),
  reason: z.string().trim().max(280, 'Keep it under 280 characters.').optional(),
})

export const milestoneSchema = z.object({
  goalId: z.string().trim().min(1),
  name: requiredText('Name the step.', 60),
})

export const goalTaskSchema = z.object({
  goalId: z.string().trim().min(1),
  title: requiredText('Enter a task.', 120),
  milestoneId: z.string().trim().optional(),
  when: z.enum(['inbox', 'today', 'tomorrow']).default('inbox'),
})

export const valueSchema = z.object({
  goalId: z.string().trim().min(1),
  value: z
    .string({ error: 'Enter a number.' })
    .trim()
    .min(1, 'Enter a number.')
    .transform((value) => Number(value.replace(',', '.')))
    .refine(Number.isFinite, 'Enter a number.'),
})

export const goalForm = new FormHandler(goalSchema, options)
export const abandonForm = new FormHandler(abandonSchema, options)
export const milestoneForm = new FormHandler(milestoneSchema, options)
export const goalTaskForm = new FormHandler(goalTaskSchema, options)
export const valueForm = new FormHandler(valueSchema, options)
