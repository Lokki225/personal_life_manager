'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { logSession, startSession, stopSession } from '@/application/personal/sessions'
import { isPersonalRuleError } from '@/domain/personal/errors'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { FormHandler } from '@/lib/forms/FormHandler'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
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

const logForm = new FormHandler(
  z.object({
    minutes: z
      .string({ error: 'Enter between 1 and 960 minutes.' })
      .trim()
      .regex(/^\d{1,3}$/, 'Enter between 1 and 960 minutes.')
      .transform(Number),
    goalId: z.string().trim().optional(),
    note: z.string().trim().max(200, 'Keep it under 200 characters.').optional(),
  }),
  { isRuleError: isPersonalRuleError },
)

export async function logSessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return signedOutState(t)
  }

  const state = await logForm.submit(formData, async (session) => {
    await logSession(user.id, {
      minutes: session.minutes,
      goalId: session.goalId || null,
      note: session.note ?? null,
      endedAt: now(),
    })
  })

  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}
