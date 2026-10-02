import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

// bcrypt only reads the first 72 bytes of a password.
export const signUpSchema = z
  .object({
    username: requiredText('Enter the name to show in the app.', 30),
    email: z
      .string({ error: 'Enter your email.' })
      .trim()
      .min(1, 'Enter your email.')
      .max(254, 'This email is too long.')
      .pipe(z.email('Enter a valid email, like you@example.com.')),
    password: z
      .string({ error: 'Choose a password.' })
      .min(8, 'Use at least 8 characters.')
      .max(72, 'Use at most 72 characters.'),
    confirmPassword: z.string({ error: 'Type the password again.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export const signUpForm = new FormHandler(signUpSchema, { isRuleError: isAccountRuleError })
