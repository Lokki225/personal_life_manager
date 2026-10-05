'use client'

import { startTransition, useActionState, useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Loader2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'
import { signOutAndClear } from '@/lib/offline/sign-out'

import { deleteAccountAction } from './actions'

// The last card of the account page. The form only shows after a first tap,
// and once the account is gone the device signs out and forgets everything.
export function DeleteAccount() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(deleteAccountAction, initialFormState)
  const deleted = state.status === 'success'

  useEffect(() => {
    if (deleted) void signOutAndClear()
  }, [deleted])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-11 text-destructive-strong">
        <Trash2 aria-hidden="true" />
        {t('Delete my account')}
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="delete-password">{t('Current password')}</Label>
        <Input
          id="delete-password"
          type="password"
          {...fieldAttributes(state, 'password', 'delete')}
          autoComplete="current-password"
          className="h-11 text-base sm:text-sm"
        />
        <FieldError state={state} name="password" scope="delete" />
      </div>
      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="understood" className="mt-0.5 size-4 accent-destructive" />
          {t('I understand that everything I recorded is deleted and cannot be brought back.')}
        </label>
        <FieldError state={state} name="understood" scope="delete" />
      </div>

      {state.formErrors[0] ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive-strong">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={isPending || deleted} className="h-11">
          {isPending || deleted ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {t('Delete everything')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending || deleted} className="h-11">
          {t('Cancel')}
        </Button>
      </div>
    </form>
  )
}
