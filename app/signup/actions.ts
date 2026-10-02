'use server'

import { registerUser } from '@/application/account/registerUser'
import { translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { signUpForm } from './schema'

export async function signUpAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const t = await getT()
  const state = await signUpForm.submit(formData, async (account) => {
    await registerUser({ email: account.email, password: account.password, username: account.username })
  })

  // The form keeps what was typed itself, so the passwords are never sent back.
  return translateFormState({ status: state.status, fieldErrors: state.fieldErrors, formErrors: state.formErrors }, t)
}
