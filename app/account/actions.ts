'use server'

import { revalidatePath } from 'next/cache'

import { changeCredentials, updateProfile } from '@/application/account/profile'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { credentialsForm, profileForm, REMOVE_PICTURE } from './schema'

// What was typed stays in the form itself, so it is never sent back: not a
// picture, and above all not a password.
const withoutValues = (state: FormState): FormState => ({
  status: state.status,
  fieldErrors: state.fieldErrors,
  formErrors: state.formErrors,
})

export async function updateProfileAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await profileForm.submit(formData, ({ picture, birthDate, ...profile }) =>
    updateProfile(userId, {
      ...profile,
      // Midday, so the date is the same day in every time zone.
      birthDate: birthDate ? new Date(`${birthDate}T12:00:00`) : null,
      picture: picture === REMOVE_PICTURE ? null : picture || undefined,
    }),
  )

  if (state.status === 'success') {
    // The name and picture show in the menu of every page.
    revalidatePath('/', 'layout')
  }

  return translateFormState(withoutValues(state), t)
}

export async function changeCredentialsAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await credentialsForm.submit(formData, (credentials) =>
    changeCredentials(userId, {
      currentPassword: credentials.currentPassword,
      email: credentials.email,
      newPassword: credentials.newPassword || null,
    }),
  )

  if (state.status === 'success') {
    revalidatePath('/', 'layout')
  }

  return translateFormState(withoutValues(state), t)
}
