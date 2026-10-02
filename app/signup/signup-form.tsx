'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CircleAlert, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldAttributes, initialFormState, type FormState } from '@/lib/forms/formState'
import { useT } from '@/lib/i18n/client'

import { signUpAction } from './actions'

// 44px touch targets and 16px text on phones (avoids iOS zoom on focus).
const FIELD_CLASS = 'h-11 text-base sm:text-sm'

export function SignUpForm() {
  const t = useT()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [state, formAction, isPending] = useActionState(async (previousState: FormState, formData: FormData) => {
    const nextState = await signUpAction(previousState, formData)

    if (nextState.status !== 'success') {
      return nextState
    }

    // The account exists: sign in with it and start the finance setup.
    const result = await signIn('credentials', { email, password, redirect: false }).catch(() => null)

    if (result?.ok && !result.error) {
      router.push('/finance/setup')
      router.refresh()
      return nextState
    }

    router.push('/login')
    return nextState
  }, initialFormState)

  // Stays busy after success, until the next page takes over.
  const isBusy = isPending || state.status === 'success'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="username">{t('Name')}</Label>
        <Input
          id="username"
          {...fieldAttributes(state, 'username')}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t('How the app should call you')}
          autoComplete="nickname"
          maxLength={30}
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="username" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">{t('Email')}</Label>
        <Input
          id="email"
          type="email"
          {...fieldAttributes(state, 'email')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="email" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">{t('Password')}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            {...fieldAttributes(state, 'password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className={`${FIELD_CLASS} pr-12`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-0 top-0 size-11 text-muted-foreground"
            aria-label={showPassword ? t('Hide password') : t('Show password')}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('At least 8 characters.')}</p>
        <FieldError state={state} name="password" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">{t('Confirm password')}</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          {...fieldAttributes(state, 'confirmPassword')}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          className={FIELD_CLASS}
        />
        <FieldError state={state} name="confirmPassword" />
      </div>

      {state.formErrors.length > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.formErrors[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={isBusy} className="h-11 w-full">
        {isBusy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {isBusy ? t('Creating your account...') : t('Create account')}
      </Button>
    </form>
  )
}
