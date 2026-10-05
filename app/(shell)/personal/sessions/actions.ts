'use server'

import { revalidatePath } from 'next/cache'

import { startSession, stopSession } from '@/application/personal/sessions'
import { isPersonalRuleError } from '@/domain/personal/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { canUsePersonal } from '../access'

const refresh = () => revalidatePath('/personal', 'layout')

// The one-tap session actions return an error message to show, or null.
async function run(task: (userId: string) => Promise<unknown>): Promise<{ error: string | null }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!(await writesAllowed(user.id))) {
    return { error: t(TOO_MANY_WRITES) }
  }

  try {
    await task(user.id)
  } catch (error) {
    if (isPersonalRuleError(error)) return { error: t(error.message) }
    throw error
  }

  refresh()
  return { error: null }
}

export async function startSessionAction(goalId: string | null) {
  return run((userId) => startSession(userId, goalId, now()))
}

export async function stopSessionAction(note: string | null) {
  return run((userId) => stopSession(userId, note, now()))
}
