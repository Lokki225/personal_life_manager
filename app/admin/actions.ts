'use server'

import { revalidatePath } from 'next/cache'

import { changeUserRole } from '@/application/account/profile'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { roleForm } from './schema'

export async function changeRoleAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [actor, t] = await Promise.all([getSignedInUser(), getT()])

  if (!actor) {
    return signedOutState(t)
  }

  const state = await roleForm.submit(formData, ({ userId, role }) => changeUserRole(actor, userId, role))

  if (state.status === 'success') {
    revalidatePath('/admin')
  }

  return translateFormState(state, t)
}
