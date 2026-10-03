'use server'

import { revalidatePath } from 'next/cache'

import { isAccountRuleError } from '@/application/account/errors'
import { createResetLink } from '@/application/account/passwordReset'
import { changeUserRole } from '@/application/account/profile'
import { resetAppRole, saveAppPersona } from '@/application/assistant/persona'
import { siteUrl } from '@/infrastructure/auth/request'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { appPersonaForm, roleForm } from './schema'

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

// Not a form: one button per person. Answers with the link, or with why not.
export async function createResetLinkAction(userId: string): Promise<{ link?: string; error?: string }> {
  const [actor, t, baseUrl] = await Promise.all([getSignedInUser(), getT(), siteUrl()])

  if (!actor) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  try {
    return { link: await createResetLink(actor, String(userId), baseUrl) }
  } catch (error) {
    if (isAccountRuleError(error)) {
      return { error: t(error.message) }
    }

    throw error
  }
}

export async function saveAppPersonaAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [actor, t] = await Promise.all([getSignedInUser(), getT()])

  if (!actor) {
    return signedOutState(t)
  }

  const state = await appPersonaForm.submit(formData, (persona) => saveAppPersona(actor, persona))

  if (state.status === 'success') {
    revalidatePath('/admin')
  }

  return translateFormState(state, t)
}

export async function resetAppRoleAction(): Promise<{ error?: string }> {
  const [actor, t] = await Promise.all([getSignedInUser(), getT()])

  if (!actor) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  try {
    await resetAppRole(actor)
    revalidatePath('/admin')
    return {}
  } catch (error) {
    if (isAccountRuleError(error)) {
      return { error: t(error.message) }
    }

    throw error
  }
}
