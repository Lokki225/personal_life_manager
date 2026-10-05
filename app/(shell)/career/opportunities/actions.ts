'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { acceptOffer, addOpportunity, deleteOpportunity, linkGoals, moveOpportunity, updateOpportunity } from '@/application/career/opportunities'
import { isCareerRuleError } from '@/domain/career/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseCareer } from '../access'
import { dayOf } from '../situation/schema'
import { acceptForm, linkGoalsForm, opportunityForm, opportunityInputFrom, statusForm } from './schema'

const refresh = () => revalidatePath('/career', 'layout')

async function signedIn() {
  return Promise.all([getSignedInUser(), getT()])
}

const tooMany = (t: (text: string) => string): FormState => ({ status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] })

export async function saveOpportunityAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await opportunityForm.submit(formData, async (form) => {
    const input = opportunityInputFrom(form)
    if (form.id) await updateOpportunity(user.id, form.id, input)
    else await addOpportunity(user.id, input, Object.keys(form.goals ?? {}))
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function moveOpportunityAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await statusForm.submit(formData, (form) => moveOpportunity(user.id, form.id, form.status, form.outcome || null, now()))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function linkGoalsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await linkGoalsForm.submit(formData, (form) => linkGoals(user.id, form.id, Object.keys(form.goals ?? {})))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function acceptOfferAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await acceptForm.submit(formData, (form) =>
    acceptOffer(
      user.id,
      form.id,
      {
        createPosition: Boolean(form.createPosition),
        startsOn: dayOf(form.startsOn)!,
        endCurrent: Boolean(form.endCurrent),
        incomeId: form.incomeId || null,
        copyJudgements: Boolean(form.copyJudgements),
      },
      now(),
    ),
  )
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function deleteOpportunityAction(id: string): Promise<{ error: string | null }> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return { error: t('Your session has ended. Sign in again to continue.') }
  if (!(await writesAllowed(user.id))) return { error: t(TOO_MANY_WRITES) }

  try {
    await deleteOpportunity(user.id, id)
  } catch (error) {
    if (isCareerRuleError(error)) return { error: t(error.message) }
    throw error
  }

  refresh()
  redirect('/career/opportunities')
}
