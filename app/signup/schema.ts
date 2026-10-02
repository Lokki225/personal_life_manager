import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'

import { emailField, nameFields, newPasswordField } from '../account/schema'

export const signUpSchema = z
  .object({
    ...nameFields,
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string({ error: 'Type the password again.' }),
    // Filled in by the page with the device's time zone.
    timeZone: z.string().trim().max(64).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export const signUpForm = new FormHandler(signUpSchema, { isRuleError: isAccountRuleError })
