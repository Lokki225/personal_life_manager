import { z } from 'zod'

import { notifyLater } from '@/app/notify-later'
import { checkApiAccess } from '@/application/account/apiTokens'
import { isAccountRuleError } from '@/application/account/errors'
import { ApiNotFound, type ApiUser, type Operation } from '@/application/api/operation'
import { DONE } from '@/application/api/operations'
import { notifyPerson, notifyReachedGoals } from '@/application/notifications/instant'
import { isFinanceRuleError } from '@/domain/finance/errors'
import { isCareerRuleError } from '@/domain/career/errors'
import { isPersonalRuleError } from '@/domain/personal/errors'
import type { ApiScope } from '@/infrastructure/repositories/apiTokenRepository'
import { setClockZone } from '@/lib/clock'
import { withOrigin } from '@/lib/origin'

// The shared frame of every API endpoint: who is calling, are they allowed,
// and one way of saying what went wrong.
//
// Every answer is JSON. A success is `{ "data": ... }`. A failure is
// `{ "error": { "code", "message", "field"? } }` with a matching status:
//   400 the request is not understood     401 no key, or an unknown one
//   403 the key may not do this           404 nothing at this address
//   422 a rule of the app refuses it      429 too many requests

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const ok = (data: unknown, status = 200) => json({ data }, status)

export const fail = (status: number, code: string, message: string, field?: string) =>
  json({ error: { code, message, ...(field ? { field } : {}) } }, status)

const CODES: Record<number, string> = { 401: 'unauthorized', 403: 'forbidden', 429: 'rate_limited' }

// Wraps an endpoint. `needs` is what the key must be allowed to do.
export function endpoint<Context>(
  needs: ApiScope,
  handle: (request: Request, user: ApiUser, context: Context, key: { id: string; name: string }) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    const access = await checkApiAccess(request.headers.get('authorization'), needs)

    if (!access.ok) {
      return fail(access.status, CODES[access.status], access.message)
    }

    // Days are counted on the key owner's clock from here on.
    setClockZone(access.owner.user.timeZone)

    try {
      // What a key records is marked with its name, for the history.
      return await withOrigin(needs === 'WRITE' ? `api:${access.owner.tokenName}` : null, () =>
        handle(request, access.owner.user, context, { id: access.owner.tokenId, name: access.owner.tokenName }),
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issue = error.issues[0]
        return fail(400, 'invalid_request', issue.message, issue.path.map(String).join('.') || undefined)
      }

      if (error instanceof ApiNotFound) {
        return fail(404, 'not_found', error.message)
      }

      if (isFinanceRuleError(error) || isAccountRuleError(error) || isPersonalRuleError(error) || isCareerRuleError(error)) {
        return fail(422, 'refused', error.message, error.field)
      }

      console.error('API error:', error)
      return fail(500, 'server_error', 'Something went wrong on our side. Try again in a moment.')
    }
  }
}

// The JSON object a request carries. Anything else counts as an empty one, so
// the answer names the first field that is missing.
async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()

    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// The endpoint of an operation: its input is the query of a GET or the JSON
// body of the others, plus what the path names (`{id}`).
export function route(operation: Operation) {
  return endpoint(operation.needs, async (request, user, context: { params: Promise<Record<string, string>> }, key) => {
    const given =
      operation.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : await jsonObject(request)
    const input = operation.input.parse({ ...given, ...(await context.params) })
    const answer = ok(await operation.run(user, input), operation.status ?? 200)
    const action = DONE[operation.name]

    // The owner hears what a key changed for them (at most once an hour per
    // key), and about a goal it got them to.
    if (action) {
      const amount = (input as { amount?: unknown }).amount

      notifyLater(() =>
        notifyPerson(user.id, {
          kind: 'changedByKey',
          tokenId: key.id,
          keyName: key.name,
          action,
          amount: typeof amount === 'number' ? amount : undefined,
        }),
      )
      notifyLater(() => notifyReachedGoals(user.id))
    }

    return answer
  })
}
