'use server'

import { revalidatePath } from 'next/cache'

import { updateProfile } from '@/application/account/profile'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { profileForm, REMOVE_PICTURE } from './schema'

export async function updateProfileAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await profileForm.submit(formData, (profile) =>
    updateProfile(userId, {
      username: profile.username,
      picture: profile.picture === REMOVE_PICTURE ? null : profile.picture || undefined,
    }),
  )

  if (state.status === 'success') {
    // The name and picture show in the menu of every page.
    revalidatePath('/', 'layout')
  }

  // The form keeps what was typed itself, so the picture is not sent back.
  return translateFormState({ status: state.status, fieldErrors: state.fieldErrors, formErrors: state.formErrors }, t)
}
