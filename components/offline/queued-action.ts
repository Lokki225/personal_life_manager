'use client'

import { useRouter } from 'next/navigation'
import type { z } from 'zod'

import type { FormAction } from '@/components/forms/action-drawer'
import type { FormHandler } from '@/lib/forms/FormHandler'
import { signedOutState, translateFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import type { OfflineAction, OfflinePayload } from '@/lib/offline/actions'
import { discard, enqueue, flush } from '@/lib/offline/outbox'

import { useOfflineUser } from './offline-user'

// Queues one action and tries to send it at once. Returns the server's refusal,
// if it refused; a refused item is not left in the outbox.
async function send<A extends OfflineAction>(userId: string, action: A, payload: OfflinePayload<A>, refresh: () => void) {
  const item = await enqueue(userId, action, payload)
  const { results } = await flush(userId)
  const result = results.get(item.id)

  if (result?.status === 'rejected') {
    await discard(item.id)
    return result.error
  }

  // Sent: the screen shows the server's numbers again.
  if (result?.status === 'synced') refresh()
  return null
}

// A capture form's action that goes through the outbox. Online, it waits for
// the server's answer, so a refusal shows in the form as before; offline, the
// action waits on the device and the form closes at once.
export function useQueuedAction<S extends z.ZodType, A extends OfflineAction>(
  action: A,
  form: FormHandler<S>,
  toPayload: (data: z.output<S>) => OfflinePayload<A>,
): FormAction {
  const t = useT()
  const router = useRouter()
  const userId = useOfflineUser()

  return async (_previous, formData) => {
    if (!userId) return signedOutState(t)

    const parsed = form.parse(formData)
    if (!parsed.ok) return translateFormState(parsed.state, t)

    const error = await send(userId, action, toPayload(parsed.data), router.refresh)
    if (error) return { status: 'error', fieldErrors: {}, formErrors: [error] }

    return { status: 'success', fieldErrors: {}, formErrors: [] }
  }
}

// The same for a one-tap button: resolves to an error message to show, or null.
export function useQueuedTap<A extends OfflineAction>(action: A) {
  const t = useT()
  const router = useRouter()
  const userId = useOfflineUser()

  return async (payload: OfflinePayload<A>): Promise<string | null> => {
    if (!userId) return t('Your session has ended. Sign in again to continue.')
    return send(userId, action, payload, router.refresh)
  }
}
