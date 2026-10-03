'use server'

import { revalidatePath } from 'next/cache'

import { isAccountRuleError } from '@/application/account/errors'
import { markFeedbackRead, sendFeedback } from '@/application/account/feedback'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { feedbackForm } from './schema'

export async function sendFeedbackAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  const state = await feedbackForm.submit(formData, (feedback) => sendFeedback(user.id, feedback))

  if (state.status === 'success') {
    revalidatePath('/admin')
  }

  return translateFormState(state, t)
}

// For administrators: everything in the inbox has been read.
export async function markFeedbackReadAction(): Promise<{ error?: string }> {
  const [actor, t] = await Promise.all([getSignedInUser(), getT()])

  if (!actor) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  try {
    await markFeedbackRead(actor)
    revalidatePath('/admin')
    return {}
  } catch (error) {
    if (isAccountRuleError(error)) {
      return { error: t(error.message) }
    }

    throw error
  }
}
