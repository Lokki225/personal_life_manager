'use client'

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from 'react'
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
import { useT } from '@/lib/i18n/client'

// A form in a bottom drawer, shared by every node.

export type FormAction = (previousState: FormState, formData: FormData) => Promise<FormState>

export const FIELD_CLASS = 'h-12 text-base'

// The form lives inside the drawer content, so it starts fresh on every open.
export function ActionForm({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: FormAction
  submitLabel: string
  onDone: () => void
  children: (state: FormState) => ReactNode
}) {
  const t = useT()
  const [state, formAction, isPending] = useActionState(async (previousState: FormState, formData: FormData) => {
    const nextState = await action(previousState, formData)

    if (nextState.status === 'success') {
      onDone()
    }

    return nextState
  }, initialFormState)

  // Dispatching by hand keeps what was typed when the server returns an error.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6" noValidate>
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

export function ActionDrawer({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)

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
