'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createEntry, deleteEntry, lockEntry, removeLock, unlockEntry, updateEntry } from '@/application/personal/journal'
import { isPersonalRuleError, PersonalRuleError } from '@/domain/personal/errors'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUsePersonal } from '../access'
import { entryForm, passwordForm } from './schema'
import { forgetUnlock, rememberUnlock, unlockedChecker } from './unlock'

const refresh = () => revalidatePath('/personal', 'layout')

// The clock zone must be set in the action itself, not in a helper it
// awaits: the setting follows the code that called it.
async function signedIn() {
  return Promise.all([getSignedInUser(), getT()])
}

export async function saveEntryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUsePersonal(user)) return signedOutState(t)

  const isUnlocked = await unlockedChecker(user.id)
  const state = await entryForm.submit(formData, async (entry) => {
    const input = {
      type: entry.type,
      title: entry.title || null,
      body: entry.body,
      mood: entry.mood,
      energy: entry.energy,
      entryDate: entry.entryDate ?? now(),
      reviewOn: entry.reviewOn,
    }

    if (entry.id) {
      await updateEntry(user.id, entry.id, input, isUnlocked(entry.id))
    } else {
      await createEntry(user.id, { ...input, password: entry.secure ? (entry.password ?? '') : null })
    }
  })

  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function unlockEntryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUsePersonal(user)) return signedOutState(t)

  const state = await passwordForm.submit(formData, async ({ id, password }) => {
    if (!(await unlockEntry(user.id, id, password))) {
      throw new PersonalRuleError('That is not the password.', 'password')
    }
    await rememberUnlock(user.id, id)
  })

  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function lockEntryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUsePersonal(user)) return signedOutState(t)

  const state = await passwordForm.submit(formData, ({ id, password }) => lockEntry(user.id, id, password))
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

export async function removeLockAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUsePersonal(user)) return signedOutState(t)

  const state = await passwordForm.submit(formData, async ({ id, password }) => {
    await removeLock(user.id, id, password)
    await forgetUnlock(id)
  })
  if (state.status === 'success') refresh()
  return translateFormState(state, t)
}

// Closes an unlocked entry again before its few minutes are up.
export async function relockEntryAction(entryId: string) {
  await forgetUnlock(entryId)
  refresh()
}

export async function deleteEntryAction(entryId: string): Promise<{ error: string | null }> {
  const [user, t] = await signedIn()
  setClockZone(user?.timeZone)
  if (!canUsePersonal(user)) return { error: t('Your session has ended. Sign in again to continue.') }

  try {
    await deleteEntry(user.id, entryId, (await unlockedChecker(user.id))(entryId))
    await forgetUnlock(entryId)
  } catch (error) {
    if (isPersonalRuleError(error)) return { error: t(error.message) }
    throw error
  }

  refresh()
  redirect('/personal/journal')
}
