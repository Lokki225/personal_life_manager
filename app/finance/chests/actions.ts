'use server'

import { revalidatePath } from 'next/cache'

import { createChest } from '@/application/finance/createChest'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import type { FormState } from '@/lib/forms/formState'

import { chestForm } from './schema'

export async function createChestAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return {
      status: 'error',
      fieldErrors: {},
      formErrors: ['Your session has ended. Sign in again to continue.'],
    }
  }

  const state = await chestForm.submit(formData, async (chest) => {
    await createChest(userId, {
      name: chest.name,
      type: chest.type,
      // End of the chosen day, so the chest stays locked through that date.
      lockedUntil: chest.lockedUntil ? new Date(`${chest.lockedUntil}T23:59:59`) : null,
    })
  })

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return state
}
