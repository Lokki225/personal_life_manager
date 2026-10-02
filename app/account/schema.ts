import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

// Sent in place of an image to delete the current picture.
export const REMOVE_PICTURE = 'remove'

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).optional()

// The names every account has: asked at sign-up and editable in the profile.
export const nameFields = {
  firstName: requiredText('Enter your first name.', 40),
  lastName: requiredText('Enter your last name.', 40),
  // A nickname, used to greet the person in place of their first name.
  username: optionalText(30),
}

export const emailField = z
  .string({ error: 'Enter your email.' })
  .trim()
  .min(1, 'Enter your email.')
  .max(254, 'This email is too long.')
  .pipe(z.email('Enter a valid email, like you@example.com.'))

// bcrypt only reads the first 72 bytes of a password.
export const newPasswordField = z
  .string({ error: 'Choose a password.' })
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')

export const profileSchema = z.object({
  ...nameFields,
  bio: optionalText(160),
  occupation: optionalText(60),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[\d\s().-]{6,20})?$/, 'Enter a phone number, for example +225 07 00 00 00 00.')
    .optional(),
  country: optionalText(56),
  city: optionalText(60),
  // From a date input: "1998-05-12", or empty.
  birthDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')
    .optional(),
  // A new image as a data URL, REMOVE_PICTURE, or empty to keep the current one.
  picture: z.string().optional(),
})

export const credentialsSchema = z
  .object({
    email: emailField,
    currentPassword: z.string({ error: 'Enter your current password.' }).min(1, 'Enter your current password.'),
    // Empty to keep the current password.
    newPassword: z.union([z.literal(''), newPasswordField]).optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => (data.newPassword ?? '') === (data.confirmPassword ?? ''), {
    error: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

const options = { isRuleError: isAccountRuleError }

export const profileForm = new FormHandler(profileSchema, options)
export const credentialsForm = new FormHandler(credentialsSchema, options)
