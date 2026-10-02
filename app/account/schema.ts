import { z } from 'zod'

import { isAccountRuleError } from '@/application/account/errors'
import { FormHandler } from '@/lib/forms/FormHandler'
import { requiredText } from '@/lib/forms/fields'

// Sent in place of an image to delete the current picture.
export const REMOVE_PICTURE = 'remove'

export const profileSchema = z.object({
  username: requiredText('Enter the name to show in the app.', 30),
  // A new image as a data URL, REMOVE_PICTURE, or empty to keep the current one.
  picture: z.string().optional(),
})

export const profileForm = new FormHandler(profileSchema, { isRuleError: isAccountRuleError })
