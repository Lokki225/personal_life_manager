import { z } from 'zod'

import { checkApiAccess } from '@/application/account/apiTokens'
import { isAccountRuleError } from '@/application/account/errors'
import { isFinanceRuleError } from '@/domain/finance/errors'
import type { ApiScope, ApiTokenOwner } from '@/infrastructure/repositories/apiTokenRepository'
import { setClockZone } from '@/lib/clock'

// The shared frame of every API endpoint: who is calling, are they allowed,
// and one way of saying what went wrong.
//
// Every answer is JSON. A success is `{ "data": ... }`. A failure is
// `{ "error": { "code", "message", "field"? } }` with a matching status:
//   400 the request is not understood     401 no key, or an unknown one
//   403 the key may not do this           404 nothing at this address
//   422 a rule of the app refuses it      429 too many requests

export type ApiUser = ApiTokenOwner['user']

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const ok = (data: unknown, status = 200) => json({ data }, status)

export const fail = (status: number, code: string, message: string, field?: string) =>
  json({ error: { code, message, ...(field ? { field } : {}) } }, status)

const CODES: Record<number, string> = { 401: 'unauthorized', 403: 'forbidden', 429: 'rate_limited' }

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

// Reads a JSON body and checks it. Throws a ZodError the frame turns into a 400.
export async function readBody<Schema extends z.ZodType>(request: Request, schema: Schema): Promise<z.output<Schema>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    body = undefined
  }

  return schema.parse(body ?? {})
}

// Wraps an endpoint. `needs` is what the key must be allowed to do.
export function endpoint<Context>(
  needs: ApiScope,
  handle: (request: Request, user: ApiUser, context: Context) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    const access = await checkApiAccess(request.headers.get('authorization'), needs)

    if (!access.ok) {
      return fail(access.status, CODES[access.status], access.message)
    }

    // Days are counted on the key owner's clock from here on.
    setClockZone(access.owner.user.timeZone)

    try {
      return await handle(request, access.owner.user, context)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues[0]
        return fail(400, 'invalid_request', issue.message, issue.path.map(String).join('.') || undefined)
      }

      if (isFinanceRuleError(error) || isAccountRuleError(error)) {
        return fail(422, 'refused', error.message, error.field)
      }

      console.error('API error:', error)
      return fail(500, 'server_error', 'Something went wrong on our side. Try again in a moment.')
    }
  }
}

// An amount in whole or decimal units, as a number.
export const amountField = z
  .number({ error: 'Give "amount" as a number, for example 1500.' })
  .positive('The amount must be greater than zero.')
  .max(999_999_999_999, 'This amount is too large.')

export const periodField = z.enum(['day', 'week', 'month', 'year'], {
  error: 'Use "day", "week", "month" or "year" for the period.',
})
