import { z } from 'zod'

export const requiredText = (message: string, max = 120) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `Keep it under ${max} characters.`)

// String first, then number. Never z.coerce.number() on raw input:
// it turns "" into 0 and accepts "1e3".
export const moneyField = z
  .string({ error: 'Enter an amount.' })
  .trim()
  .min(1, 'Enter an amount.')
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Use digits only, for example 60000.')
  .transform(Number)
  .pipe(z.number().positive('Enter an amount greater than zero.'))
