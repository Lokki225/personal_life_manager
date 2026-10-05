'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  abandonCareerGoal,
  addCriterion,
  confirmAchieved,
  createCareerGoal,
  judge,
  markCriterionReviewed,
  pauseGoal,
  removeCriterion,
  reopenGoal,
  resumeGoal,
  supersedeGoal,
  updateCareerGoal,
} from '@/application/career/goals'
import { isCareerRuleError } from '@/domain/career/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseCareer } from '../access'
import { dayOf } from '../situation/schema'
import { abandonForm, criterionForm, criterionFrom, goalForm, judgeForm, supersedeForm } from './schema'

const refresh = () => revalidatePath('/career', 'layout')

async function signedIn() {
  return Promise.all([getSignedInUser(), getT()])
}

const tooMany = (t: (text: string) => string): FormState => ({ status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] })

export async function saveGoalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  let createdId: string | null = null
  const state = await goalForm.submit(formData, async (form) => {
    const fields = { name: form.name, why: form.why || null, deadline: dayOf(form.deadline), importance: form.importance || null }
    if (form.id) await updateCareerGoal(user.id, form.id, fields)
    else createdId = (await createCareerGoal(user.id, fields)).id
  })

  if (state.status !== 'success') return translateFormState(state, t)
  refresh()
  // A new goal opens on its page, where its criteria are added.
  if (createdId) redirect(`/career/goals/${createdId}`)
  return translateFormState(state, t)
}

export async function addCriterionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await criterionForm.submit(formData, (form) => addCriterion(user.id, form.goalId, criterionFrom(form)))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function judgeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await judgeForm.submit(formData, (form) => judge(user.id, form.conditionId, form.result, form.note || null, now()))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function abandonGoalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await abandonForm.submit(formData, (form) => abandonCareerGoal(user.id, form.id, form.reason || null, now()))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function supersedeGoalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return tooMany(t)

  const state = await supersedeForm.submit(formData, (form) => supersedeGoal(user.id, form.id, form.byId, now()))
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

export async function goalStateAction(goalId: string, change: 'confirm' | 'reopen' | 'pause' | 'resume') {
  return run((userId) => {
    switch (change) {
      case 'confirm':
        return confirmAchieved(userId, goalId, now())
      case 'reopen':
        return reopenGoal(userId, goalId)
      case 'pause':
        return pauseGoal(userId, goalId, now())
      case 'resume':
        return resumeGoal(userId, goalId)
    }
  })
}

export async function removeCriterionAction(goalId: string, conditionId: string) {
  return run((userId) => removeCriterion(userId, goalId, conditionId))
}

export async function markCriterionReviewedAction(conditionId: string) {
  return run((userId) => markCriterionReviewed(userId, conditionId, now()))
}
