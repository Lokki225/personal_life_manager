'use server'

import { limitAttempts } from '@/application/account/passwordReset'
import { registerUser } from '@/application/account/registerUser'
import { clientIp } from '@/infrastructure/auth/request'
import { translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { signUpForm } from './schema'

export async function signUpAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [t, ip] = await Promise.all([getT(), clientIp()])

  // A field people never see. Only a program filling in everything writes in
  // it, and it is told all went well so it has nothing to adapt to.
  if (formData.get('website')) {
    return { status: 'success', fieldErrors: {}, formErrors: [] }
  }

  const state = await signUpForm.submit(formData, async (account) => {
    await limitAttempts('signUp', ip)
    await registerUser({
      email: account.email,
      password: account.password,
      firstName: account.firstName,
      lastName: account.lastName,
      username: account.username,
    })
  })

  // The form keeps what was typed itself, so the passwords are never sent back.
  return translateFormState({ status: state.status, fieldErrors: state.fieldErrors, formErrors: state.formErrors }, t)
}
