'use client'

import {
  cloneElement,
  isValidElement,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { initialFormState, type FormState } from '@/lib/forms/formState'
import { useIsOffline } from '@/components/offline/connection'
import { useOfflineUser } from '@/components/offline/offline-user'
import { clearDraft, fillForm, formValues, loadDraft, saveDraft } from '@/lib/offline/drafts'
import { useT } from '@/lib/i18n/client'

// A form in a bottom drawer, shared by every node.

export type FormAction = (previousState: FormState, formData: FormData) => Promise<FormState>

export const FIELD_CLASS = 'h-12 text-base'

// The form lives inside the drawer content, so it starts fresh on every open.
// With a `draftKey`, what is typed is kept on the device until it is sent,
// so a closed drawer, a reload or a lost connection loses nothing.
export function ActionForm({
  action,
  submitLabel,
  onDone,
  children,
  draftKey,
}: {
  action: FormAction
  submitLabel: string
  onDone: () => void
  children: (state: FormState) => ReactNode
  draftKey?: string
}) {
  const t = useT()
  const userId = useOfflineUser()
  const form = useRef<HTMLFormElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drafting = Boolean(draftKey && userId)

  const [state, formAction, isPending] = useActionState(async (previousState: FormState, formData: FormData) => {
    const nextState = await action(previousState, formData)

    if (nextState.status === 'success') {
      if (drafting) void clearDraft(userId!, draftKey!)
      onDone()
    }

    return nextState
  }, initialFormState)

  // The draft comes back when the form opens again.
  useEffect(() => {
    if (!drafting) return
    let cancelled = false
    void loadDraft(userId!, draftKey!).then((values) => {
      if (!cancelled && values && form.current) fillForm(form.current, values)
    })
    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [drafting, userId, draftKey])

  const keepDraft = () => {
    if (!drafting || !form.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const current = form.current
    saveTimer.current = setTimeout(() => void saveDraft(userId!, draftKey!, formValues(current)), 300)
  }

  // Dispatching by hand keeps what was typed when the server returns an error.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form ref={form} onSubmit={handleSubmit} onInput={keepDraft} onChange={keepDraft} className="space-y-4 px-4 pb-6" noValidate>
      {children(state)}

      {state.formErrors.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="h-12 w-full text-base">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isPending ? t('Saving...') : submitLabel}
      </Button>
    </form>
  )
}

// Most drawers change the plan, move money or need the server, so offline
// their trigger is disabled with the reason. A capture drawer (an expense, a
// session) passes `worksOffline`: what it sends waits for the connection.
export function ActionDrawer({
  trigger,
  title,
  description,
  children,
  worksOffline = false,
  offlineReason,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: (close: () => void) => ReactNode
  worksOffline?: boolean
  offlineReason?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const offline = useIsOffline()

  if (offline && !worksOffline && isValidElement(trigger)) {
    const reason = offlineReason ?? t('This needs a connection.')
    return cloneElement(trigger as ReactElement<{ disabled?: boolean; title?: string; 'aria-description'?: string }>, {
      disabled: true,
      title: reason,
      'aria-description': reason,
    })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {children(() => setOpen(false))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
