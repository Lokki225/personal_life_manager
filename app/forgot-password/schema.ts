import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'

import { emailField, newPasswordField } from '../account/schema'

const options = { isRuleError: isAccountRuleError }

export const forgotPasswordForm = new FormHandler(z.object({ email: emailField }), options)

export const resetPasswordForm = new FormHandler(
  z
    .object({
      token: z.string({ error: 'This link is not valid.' }).min(1, 'This link is not valid.'),
      password: newPasswordField,
      confirmPassword: z.string({ error: 'Type the password again.' }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      error: 'The two passwords do not match.',
      path: ['confirmPassword'],
    }),
  options,
)
