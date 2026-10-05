'use server'

import { revalidatePath } from 'next/cache'

import {
  addEvidence,
  addFact,
  deleteEvidence,
  endFact,
  makePrimary,
  markReviewed,
  saveLocations,
  unlinkEvidence,
  updateFact,
} from '@/application/career/situation'
import { isCareerRuleError } from '@/domain/career/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseCareer } from '../access'
import { dayOf, endFactForm, evidenceForm, factForm, factInputFrom, locationsForm } from './schema'

const refresh = () => revalidatePath('/career', 'layout')

// The clock zone is set in each action itself: the setting follows the code
// that called it, not a helper it awaits.
async function signedIn() {
  return Promise.all([getSignedInUser(), getT()])
}

const tooMany = (t: (text: string) => string): FormState => ({ status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] })

export async function saveFactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await factForm.submit(formData, async (form) => {
    const input = factInputFrom(form)
    if (form.id) {
      await updateFact(user.id, form.id, { ...input, confirmed: Boolean(form.confirmed) })
    } else {
      await addFact(user.id, { ...input, primary: Boolean(form.primary) })
    }
  })

  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function endFactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await endFactForm.submit(formData, ({ id, validTo }) => endFact(user.id, id, dayOf(validTo)!))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function addEvidenceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await evidenceForm.submit(formData, async (form) => {
    await addEvidence(user.id, {
      title: form.title,
      url: form.url || null,
      description: form.description || null,
      factIds: Object.keys(form.facts ?? {}),
    })
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function saveLocationsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await locationsForm.submit(formData, ({ places }) => saveLocations(user.id, (places ?? '').split('\n')))
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

export async function makePrimaryAction(factId: string) {
  return run((userId) => makePrimary(userId, factId, now()))
}

export async function markReviewedAction(factId: string) {
  return run((userId) => markReviewed(userId, factId, now()))
}

export async function unlinkEvidenceAction(evidenceId: string, factId: string) {
  return run((userId) => unlinkEvidence(userId, evidenceId, factId))
}

export async function deleteEvidenceAction(evidenceId: string) {
  return run((userId) => deleteEvidence(userId, evidenceId))
}
