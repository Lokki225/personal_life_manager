import { z } from 'zod'

import type { ApiScope, ApiTokenOwner } from '../../infrastructure/repositories/apiTokenRepository'

// One thing a program can do for a person. The HTTP routes of the API and the
// tools of the assistant are both made from these, so the two can never drift
// apart: whatever one can do, the other can.

export type ApiUser = ApiTokenOwner['user']

export type Operation<Schema extends z.ZodType = z.ZodType> = {
  // The name the assistant calls it by.
  name: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  // Under /api/v1, e.g. '/finance/expenses/{id}'.
  path: string
  // 'READ' operations change nothing.
  needs: ApiScope
  does: string
  // The query of a GET, or the JSON body of the others, plus the `{id}` of the path.
  input: Schema
  // The HTTP status of a success. 200 when left out.
  status?: number
  run: (user: ApiUser, input: z.output<Schema>) => Promise<unknown>
}

export const operation = <Schema extends z.ZodType>(definition: Operation<Schema>) => definition

// Thrown when the thing an operation is asked to act on does not exist.
export class ApiNotFound extends Error {}

// A date as the person reads it on their own clock, e.g. "2026-10-03T19:30:00".
// No time zone is attached on purpose: every date in the app is already on the
// clock of its owner.
export function localTime(date: Date | null | undefined): string | null {
  if (!date) {
    return null
  }

  const two = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

// --- Fields shared by several operations -------------------------------------

export const noInput = z.object({})

export const idField = z.string({ error: 'Give the id.' }).trim().min(1, 'Give the id.')

// An amount in whole or decimal units, as a number.
export const amountField = z
  .number({ error: 'Give "amount" as a number, for example 1500.' })
  .positive('The amount must be greater than zero.')
  .max(999_999_999_999, 'This amount is too large.')

export const periodField = z.enum(['day', 'week', 'month', 'year'], {
  error: 'Use "day", "week", "month" or "year" for the period.',
})

export const payDayField = z
  .number({ error: 'Give "payDay" as a day of the month, from 1 to 31.' })
  .int('Give "payDay" as a day of the month, from 1 to 31.')
  .min(1, 'Give "payDay" as a day of the month, from 1 to 31.')
  .max(31, 'Give "payDay" as a day of the month, from 1 to 31.')

export const text = (name: string, max: number) =>
  z
    .string({ error: `Give "${name}".` })
    .trim()
    .min(1, `Give "${name}".`)
    .max(max, `Keep "${name}" under ${max} characters.`)

// A calendar day, e.g. "2026-12-31".
export const dayField = z
  .string({ error: 'Give the date as "2026-12-31".' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Give the date as "2026-12-31".')
  .refine((day) => !Number.isNaN(new Date(`${day}T23:59:59`).getTime()), 'This date does not exist.')

// The end of that day, so it still counts during the whole date.
export const endOfDay = (day: string | null | undefined) => (day ? new Date(`${day}T23:59:59`) : null)
