import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { processSyncItems } from '@/application/offline/sync'
import { notifyReachedGoals } from '@/application/notifications/instant'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { securityRepository } from '@/infrastructure/repositories/securityRepository'
import { now, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { syncRequestSchema } from '@/lib/offline/actions'

// Receives the actions a device captured offline (its outbox) and runs them
// (Ressources/offline-mode-codebase-plan.md, step 5). Only for the signed-in
// person, from the app's own pages, a limited number of times a minute.

const PER_MINUTE = 60

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  // Only the app's own pages may send: another site cannot make a signed-in
  // browser record things.
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'forbidden' }, 403)
  }

  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  // The device keeps its outbox and tries again after signing in.
  if (!user) {
    return json({ error: 'unauthorized' }, 401)
  }

  setClockZone(user.timeZone)

  if (!(await securityRepository.allowAttempt(`sync:${user.id}`, PER_MINUTE, 60_000))) {
    return json({ error: 'rate_limited' }, 429)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }

  const parsed = syncRequestSchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'invalid_request' }, 400)
  }

  const results = await processSyncItems(user, parsed.data.items, now(), t)

  if (results.some((result) => result.status === 'synced')) {
    revalidatePath('/finance', 'layout')
    revalidatePath('/personal', 'layout')
    // As after a form: a goal the money just reached is announced.
    notifyLater(() => notifyReachedGoals(user.id))
  }

  return json({ results })
}
