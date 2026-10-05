'use client'

import { startTransition, useActionState, type FormEvent } from 'react'
import Link from 'next/link'
import { CircleAlert, CircleCheck, KeyRound, Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { forgotPasswordAction, resetPasswordAction } from './actions'

// 44px touch targets and 16px text on phones (avoids iOS zoom on focus).
const FIELD_CLASS = 'h-11 text-base sm:text-sm'

function useForm(action: (previous: FormState, formData: FormData) => Promise<FormState>) {
  const [state, formAction, isPending] = useActionState(action, initialFormState)

  // Dispatching by hand keeps what was typed when the server returns an error.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return { state, isPending, onSubmit }
}

function FormError({ state }: { state: FormState }) {
  return state.formErrors.length > 0 ? (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {state.formErrors[0]}
    </p>
  ) : null
}

function Done({ children }: { children: string }) {
  return (
    <p role="status" className="mt-8 flex items-start gap-2 rounded-lg border bg-card px-3 py-3 text-sm">
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      {children}
    </p>
  )
}

// `canEmail` is false when the app has no way to send email yet.
export function ForgotPasswordForm({ canEmail }: { canEmail: boolean }) {
  const t = useT()
  const { state, isPending, onSubmit } = useForm(forgotPasswordAction)

  if (!canEmail) {
    return (
      <p className="mt-8 rounded-lg border bg-card px-3 py-3 text-sm">
        {t('Reset links are not sent by email yet. Ask an administrator of the app: they can create a reset link for you.')}
      </p>
    )
  }

  if (state.status === 'success') {
    return (
      <Done>
        {t('If an account uses this email, a link to choose a new password is on its way. It works for one hour.')}
      </Done>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">{t('Email')}</Label>
        <Input
          id="email"
          type="email"
          {...fieldAttributes(state, 'email')}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="email" />
      </div>
      <FormError state={state} />
      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {isPending ? t('Sending...') : t('Send me a link')}
      </Button>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT()
  const { state, isPending, onSubmit } = useForm(resetPasswordAction)

  if (state.status === 'success') {
    return (
      <>
        <Done>{t('Your password is changed. You can sign in with it now.')}</Done>
        <Button asChild className="mt-4 h-11 w-full">
          <Link href="/login">{t('Sign in')}</Link>
        </Button>
      </>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label htmlFor="password">{t('New password')}</Label>
        <Input
          id="password"
          type="password"
          {...fieldAttributes(state, 'password')}
          autoComplete="new-password"
          autoFocus
          className={FIELD_CLASS}
        />
        <p className="text-xs text-muted-foreground">{t('At least 10 characters.')}</p>
        <FieldError state={state} name="password" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">{t('Confirm password')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...fieldAttributes(state, 'confirmPassword')}
          autoComplete="new-password"
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="confirmPassword" />
      </div>
      <FieldError state={state} name="token" />
      <FormError state={state} />
      <Button type="submit" disabled={isPending} className="h-11 w-full">
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
        {isPending ? t('Saving...') : t('Change my password')}
      </Button>
    </form>
  )
}
