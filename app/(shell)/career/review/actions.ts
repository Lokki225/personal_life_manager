'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { saveReviewAnswers } from '@/application/career/review'
import { isCareerRuleError } from '@/domain/career/errors'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { FormHandler } from '@/lib/forms/FormHandler'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUseCareer } from '../access'

const answersForm = new FormHandler(
  z.object({
    forward: z.string().trim().max(1000, 'Keep it under 1,000 characters.').optional(),
    next: z.string().trim().max(1000, 'Keep it under 1,000 characters.').optional(),
  }),
  { isRuleError: isCareerRuleError },
)

export async function saveAnswersAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)
  if (!canUseCareer(user)) return signedOutState(t)
  if (!(await writesAllowed(user.id))) return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }

  const state = await answersForm.submit(formData, (form) => saveReviewAnswers(user.id, { forward: form.forward || null, next: form.next || null }, t, now()))
  if (state.status === 'success') {
    revalidatePath('/career', 'layout')
    revalidatePath('/personal/journal')
  }
  return translateFormState(state, t)
}
