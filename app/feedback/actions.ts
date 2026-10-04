'use server'

import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { isAccountRuleError } from '@/application/account/errors'
import { markFeedbackRead, sendFeedback } from '@/application/account/feedback'
import { notifyAdmins } from '@/application/notifications/instant'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { fullName } from '@/lib/greeting'
import { getT } from '@/lib/i18n/server'

import { feedbackForm } from './schema'

export async function sendFeedbackAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  let message = ''
  const state = await feedbackForm.submit(formData, async (feedback) => {
    await sendFeedback(user.id, feedback)
    message = feedback.message.trim()
  })

  if (state.status === 'success') {
    revalidatePath('/admin')
    notifyLater(() => notifyAdmins({ kind: 'newFeedback', name: fullName(user), message }))
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
