import { z } from 'zod'

import { isPersonalRuleError } from '@/domain/personal/errors'
import type { Recurrence } from '@/domain/personal/tasks'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

const options = { isRuleError: isPersonalRuleError }

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

// When a task is for. "date" uses the date field; "inbox" has no day yet.
export const WHEN = ['today', 'tomorrow', 'date', 'inbox'] as const
export const REPEAT = ['none', 'daily', 'weekdays', 'weekly', 'everyN'] as const

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')

export const taskSchema = z
  .object({
    title: requiredText('Enter a task.', 120),
    when: z.enum(WHEN, { error: 'Choose when.' }).default('today'),
    date: z.string().trim().optional(),
    repeat: z.enum(REPEAT, { error: 'Choose how it repeats.' }).default('none'),
    // Weekly: one checkbox per weekday, day1 (Monday) to day7 (Sunday).
    ...Object.fromEntries(WEEKDAYS.map((d) => [`day${d}`, z.string().optional()])),
    every: z.string().trim().optional(),
    categoryId: z.string().trim().optional(),
  })
  .superRefine((task, context) => {
    if (task.repeat === 'none' && task.when === 'date' && !isoDate.safeParse(task.date).success) {
      context.addIssue({ code: 'custom', path: ['date'], message: 'Choose a date.' })
    }
    if (task.repeat === 'weekly' && !WEEKDAYS.some((d) => (task as Record<string, unknown>)[`day${d}`])) {
      context.addIssue({ code: 'custom', path: ['repeat'], message: 'Choose at least one day.' })
    }
    if (task.repeat === 'everyN' && !/^([1-9]|[1-9]\d)$/.test(task.every ?? '')) {
      context.addIssue({ code: 'custom', path: ['every'], message: 'Enter a number of days from 1 to 99.' })
    }
  })

export type TaskFormData = z.output<typeof taskSchema>

// The recurrence the form describes, or null for a one-off task.
export function recurrenceFrom(task: TaskFormData): Recurrence | null {
  switch (task.repeat) {
    case 'daily':
      return { kind: 'daily' }
    case 'weekdays':
      return { kind: 'weekly', days: [1, 2, 3, 4, 5] }
    case 'weekly':
      return { kind: 'weekly', days: WEEKDAYS.filter((d) => (task as Record<string, unknown>)[`day${d}`]) }
    case 'everyN':
      return { kind: 'everyN', n: Number(task.every) }
    default:
      return null
  }
}

// The day the form asks for, on the person's clock. A repeating task starts
// on that day (today unless a date is given).
export function dueDateFrom(task: TaskFormData, today: Date): Date | null {
  if (task.when === 'inbox' && task.repeat === 'none') return null
  if (task.when === 'tomorrow') return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (task.when === 'date' && task.date && isoDate.safeParse(task.date).success) {
    const [y, m, d] = task.date.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return today
}

export const capacitySchema = z.object({
  capacity: z.string().trim().regex(/^\d{1,2}$/, 'Choose between 1 and 30 tasks.').transform(Number),
})

export const taskForm = new FormHandler(taskSchema, options)
export const capacityForm = new FormHandler(capacitySchema, options)
