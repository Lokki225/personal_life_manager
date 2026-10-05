'use server'

import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { createApiToken, deleteApiToken } from '@/application/account/apiTokens'
import { deleteAccount } from '@/application/account/deleteAccount'
import { changeCredentials, updateProfile } from '@/application/account/profile'
import { notifyPerson } from '@/application/notifications/instant'
import { notifyDevices } from '@/application/notifications/notify'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { isPushConfigured } from '@/infrastructure/push/sendPush'
import { pushRepository } from '@/infrastructure/repositories/pushRepository'
import { securityRepository } from '@/infrastructure/repositories/securityRepository'
import { userRepository } from '@/infrastructure/repositories/userRepository'
import { notificationRepository } from '@/infrastructure/repositories/notificationRepository'
import { isValidTimeZone, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { apiTokenForm, credentialsForm, deleteAccountForm, deleteApiTokenForm, profileForm, REMOVE_PICTURE } from './schema'

// What was typed stays in the form itself, so it is never sent back: not a
// picture, and above all not a password.
const withoutValues = (state: FormState): FormState => ({
  status: state.status,
  fieldErrors: state.fieldErrors,
  formErrors: state.formErrors,
})

export async function updateProfileAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await profileForm.submit(formData, ({ picture, birthDate, ...profile }) =>
    updateProfile(userId, {
      ...profile,
      // Midday, so the date is the same day in every time zone.
      birthDate: birthDate ? new Date(`${birthDate}T12:00:00`) : null,
      picture: picture === REMOVE_PICTURE ? null : picture || undefined,
    }),
  )

  if (state.status === 'success') {
    // The name and picture show in the menu of every page.
    revalidatePath('/', 'layout')
  }

  return translateFormState(withoutValues(state), t)
}

export async function changeCredentialsAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  let changed = { email: false, password: false }
  const state = await credentialsForm.submit(formData, async (credentials) => {
    await changeCredentials(userId, {
      currentPassword: credentials.currentPassword,
      email: credentials.email,
      newPassword: credentials.newPassword || null,
    })
    changed = {
      email: credentials.email.trim().toLowerCase() !== user!.email,
      password: Boolean(credentials.newPassword),
    }
  })

  if (state.status === 'success') {
    revalidatePath('/', 'layout')

    // A security notice to every device of the account.
    if (changed.email || changed.password) {
      notifyLater(() => notifyPerson(userId, { kind: 'credentialsChanged', ...changed }))
    }
  }

  return translateFormState(withoutValues(state), t)
}

// Deletes the account for good. The device signs out and clears itself after.
export async function deleteAccountAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  // A few tries only: the password is what guards this.
  if (!(await securityRepository.allowAttempt(`deleteAccount:${user.id}`, 5, 15 * 60_000))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t('Too many tries. Wait 15 minutes and try again.')] }
  }

  const state = await deleteAccountForm.submit(formData, ({ password }) => deleteAccount(user, password))

  return translateFormState(withoutValues(state), t)
}

// Called by the page itself, not by a form: the device says which time zone it
// is in, and an account that has none yet takes it.
export async function reportTimeZoneAction(timeZone: string): Promise<void> {
  const user = await getSignedInUser()

  if (user && !user.timeZone && isValidTimeZone(timeZone)) {
    await userRepository.setTimeZoneIfMissing(user.id, timeZone)
    revalidatePath('/', 'layout')
  }
}

// What a browser hands over when a device subscribes. Checked by hand: it is
// not a form, and the address has to be a real push service.
function readSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const value = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const endpoint = value?.endpoint
  const p256dh = value?.keys?.p256dh
  const auth = value?.keys?.auth

  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return null
  }

  if (endpoint.length > 2000 || p256dh.length > 200 || auth.length > 200 || !endpoint.startsWith('https://')) {
    return null
  }

  return { endpoint, p256dh, auth }
}

export async function subscribePushAction(input: unknown): Promise<{ error?: string }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const subscription = readSubscription(input)

  if (!user) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!subscription || !isPushConfigured()) {
    return { error: t('Notifications could not be turned on for this device.') }
  }

  await pushRepository.saveSubscription(user.id, subscription)

  return {}
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const user = await getSignedInUser()

  if (user && typeof endpoint === 'string') {
    await pushRepository.removeSubscription(user.id, endpoint)
  }
}

export async function sendTestPushAction(): Promise<{ error?: string }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  const delivered = await notifyDevices(await pushRepository.listSubscriptions(user.id), {
    title: t('Notifications are working'),
    body: t('This is what a reminder from Personal Life Manager looks like.'),
    url: '/finance',
  })

  return delivered > 0 ? {} : { error: t('The test could not be sent. Turn notifications off and on again.') }
}

// The answer to creating a key carries the key itself, this once.
export type CreateTokenState = FormState & { token?: string }

export async function createApiTokenAction(_previousState: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  let token: string | undefined
  let name = ''
  const state = await apiTokenForm.submit(formData, async (input) => {
    token = await createApiToken(user.id, input)
    name = input.name.trim()
  })

  if (state.status === 'success') {
    revalidatePath('/account')
    notifyLater(() => notifyPerson(user.id, { kind: 'apiKeyCreated', name }))
  }

  return { ...translateFormState(state, t), token }
}

export async function deleteApiTokenAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return signedOutState(t)
  }

  const state = await deleteApiTokenForm.submit(formData, ({ id }) => deleteApiToken(user.id, id))

  if (state.status === 'success') {
    revalidatePath('/account')
  }

  return translateFormState(state, t)
}

// Turns one kind of notification on or off for the signed-in person.
export async function setNotificationChoiceAction(choice: unknown, enabled: unknown): Promise<{ error?: string }> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  // Administration alerts only mean something to an administrator.
  if ((choice !== 'notifyMoney' && choice !== 'notifyAdmin') || (choice === 'notifyAdmin' && user.role !== 'ADMIN')) {
    return { error: t('Choose on or off.') }
  }

  await notificationRepository.setPreferences(user.id, { [choice]: enabled === true })

  return {}
}
