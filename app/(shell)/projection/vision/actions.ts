'use server'

import { revalidatePath } from 'next/cache'

import { createLifeArea, moveLifeArea, removeLifeArea, setGoalArea, updateLifeArea } from '@/application/lifeAreas/areas'
import { isLifeAreaRuleError } from '@/domain/lifeAreas/areas'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseProjection } from '../access'
import { areaForm } from './schema'

// Areas show on goals in every node.
const refresh = () => {
  revalidatePath('/projection', 'layout')
  revalidatePath('/personal', 'layout')
  revalidatePath('/career', 'layout')
}

export async function saveAreaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)
  if (!canUseProjection(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }

  const state = await areaForm.submit(formData, async (form) => {
    const input = { name: form.name, statement: form.statement || null, color: form.color || null, icon: form.icon || null }
    if (form.id) await updateLifeArea(user.id, form.id, input)
    else await createLifeArea(user.id, input)
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

// The one-tap actions return an error message to show, or null.
async function run(task: (userId: string) => Promise<unknown>): Promise<{ error: string | null }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)
  if (!canUseProjection(user)) return { error: t('Your session has ended. Sign in again to continue.') }
  if (!(await writesAllowed(user.id))) return { error: t(TOO_MANY_WRITES) }

  try {
    await task(user.id)
  } catch (error) {
    if (isLifeAreaRuleError(error)) return { error: t(error.message) }
    throw error
  }

  refresh()
  return { error: null }
}

export async function moveAreaAction(id: string, direction: 'up' | 'down') {
  return run((userId) => moveLifeArea(userId, id, direction))
}

export async function removeAreaAction(id: string) {
  return run((userId) => removeLifeArea(userId, id))
}

// Used from the goal pages of Personal and Career.
export async function setGoalAreaAction(goalId: string, lifeAreaId: string | null) {
  return run((userId) => setGoalArea(userId, goalId, lifeAreaId))
}
