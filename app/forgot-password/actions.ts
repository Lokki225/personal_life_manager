'use server'

import { requestPasswordReset, resetPassword } from '@/application/account/passwordReset'
import { clientIp, siteUrl } from '@/infrastructure/auth/request'
import { translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { forgotPasswordForm, resetPasswordForm } from './schema'

// What was typed stays in the form, so no password travels back.
const withoutValues = (state: FormState): FormState => ({
  status: state.status,
  fieldErrors: state.fieldErrors,
  formErrors: state.formErrors,
})

export async function forgotPasswordAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [t, ip, baseUrl] = await Promise.all([getT(), clientIp(), siteUrl()])

  const state = await forgotPasswordForm.submit(formData, ({ email }) =>
    requestPasswordReset({
      email,
      ip,
      baseUrl,
      message: (link, firstName) => ({
        subject: t('Choose a new password'),
        text: [
          firstName ? t('Hello {name},', { name: firstName }) : t('Hello,'),
          '',
          t('Someone asked to reset the password of your Personal Life Manager account. To choose a new one, open this link within the hour:'),
          '',
          link,
          '',
          t('If it was not you, ignore this message: your password stays the same.'),
        ].join('\n'),
      }),
    }),
  )

  return translateFormState(state, t)
}

export async function resetPasswordAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [t, ip] = await Promise.all([getT(), clientIp()])

  const state = await resetPasswordForm.submit(formData, ({ token, password }) =>
    resetPassword({ token, password, ip }),
  )

  return translateFormState(withoutValues(state), t)
}
