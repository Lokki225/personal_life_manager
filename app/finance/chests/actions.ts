'use server'

import { revalidatePath } from 'next/cache'

import { createChest } from '@/application/finance/createChest'
import { deleteChest } from '@/application/finance/deleteChest'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import type { FormState } from '@/lib/forms/formState'

import { chestForm, deleteChestForm } from './schema'

const SIGNED_OUT: FormState = {
  status: 'error',
  fieldErrors: {},
  formErrors: ['Your session has ended. Sign in again to continue.'],
}

export async function createChestAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
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

export async function deleteChestAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
  }

  const state = await deleteChestForm.submit(formData, ({ chestId }) => deleteChest(userId, chestId))

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return state
}
