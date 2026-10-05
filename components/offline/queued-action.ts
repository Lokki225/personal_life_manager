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

    const item = await enqueue(userId, action, toPayload(parsed.data))
    const { results } = await flush(userId)
    const result = results.get(item.id)

    // Refused by the server: shown in the form, and not left in the outbox.
    if (result?.status === 'rejected') {
      await discard(item.id)
      return { status: 'error', fieldErrors: {}, formErrors: [result.error] }
    }

    // Sent: the screen shows the server's numbers again.
    if (result?.status === 'synced') router.refresh()

    return { status: 'success', fieldErrors: {}, formErrors: [] }
  }
}
