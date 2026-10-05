'use server'

import { revalidatePath } from 'next/cache'

import { writeLog } from '@/application/career/log'
import { addFocus, bringToThisWeek, carryToNextWeek, removeFocus, setFocusDone } from '@/application/career/week'
import { isCareerRuleError } from '@/domain/career/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseCareer } from '../access'
import { alsoFrom, focusForm, logForm } from './schema'

// The quick log also writes to the journal and may change the situation.
const refresh = () => {
  revalidatePath('/career', 'layout')
  revalidatePath('/personal/journal')
}

async function signedIn() {
  return Promise.all([getSignedInUser(), getT()])
}

const tooMany = (t: (text: string) => string): FormState => ({ status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] })

export async function addFocusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await focusForm.submit(formData, async (form) => {
    await addFocus(user.id, { title: form.title, goalId: form.goalId || null, opportunityId: form.opportunityId || null }, now())
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function writeLogAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await logForm.submit(formData, async (form) => {
    await writeLog(user.id, { body: form.body, goalId: form.goalId || null, opportunityId: form.opportunityId || null, also: alsoFrom(form) }, now())
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

// The one-tap actions return an error message to show, or null.
async function run(task: (userId: string) => Promise<unknown>): Promise<{ error: string | null }> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return { error: t('Your session has ended. Sign in again to continue.') }
  if (!(await writesAllowed(user.id))) return { error: t(TOO_MANY_WRITES) }

  try {
    await task(user.id)
  } catch (error) {
    if (isCareerRuleError(error)) return { error: t(error.message) }
    throw error
  }

  refresh()
  return { error: null }
}

export async function focusDoneAction(id: string, done: boolean) {
  return run((userId) => setFocusDone(userId, id, done))
}

export async function removeFocusAction(id: string) {
  return run((userId) => removeFocus(userId, id))
}

export async function carryAction() {
  return run((userId) => carryToNextWeek(userId, now()))
}

export async function bringAction(id: string) {
  return run((userId) => bringToThisWeek(userId, id, now()))
}
