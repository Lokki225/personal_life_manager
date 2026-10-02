'use server'

import { revalidatePath } from 'next/cache'

import { createChest } from '@/application/finance/createChest'
import { deleteChest } from '@/application/finance/deleteChest'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { userRepository } from '@/infrastructure/repositories/userRepository'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'

import { chestForm, deleteChestForm, sweepDayForm } from './schema'

export async function createChestAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
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

  return translateFormState(state, t)
}

export async function deleteChestAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await deleteChestForm.submit(formData, ({ chestId }) => deleteChest(userId, chestId))

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return translateFormState(state, t)
}

export async function setSweepDayAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await sweepDayForm.submit(formData, ({ day }) => userRepository.setBufferSweepDay(userId, day))

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return translateFormState(state, t)
}
