'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CircleAlert, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 44px touch targets and 16px text on phones (avoids iOS zoom on focus).
const FIELD_CLASS = 'h-11 text-base sm:text-sm'
const ERROR_ID = 'login-error'

type LoginError = { kind: 'credentials' | 'server'; message: string }

const INVALID_CREDENTIALS: LoginError = { kind: 'credentials', message: 'Invalid email or password.' }
const SERVER_UNAVAILABLE: LoginError = {
  kind: 'server',
  message: 'We could not sign you in right now. Check your connection and try again.',
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<LoginError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await signIn('credentials', { email, password, redirect: false })

      if (result?.ok && !result.error) {
        // Keep the button busy until the next page takes over.
        router.push(callbackUrl)
        router.refresh()
        return
      }

      // Only a refused login is the user's mistake; anything else is ours.
      setError(result?.error === 'CredentialsSignin' ? INVALID_CREDENTIALS : SERVER_UNAVAILABLE)
    } catch {
      setError(SERVER_UNAVAILABLE)
    }

    setIsSubmitting(false)
  }

  const fieldErrorProps = {
    'aria-invalid': error?.kind === 'credentials' ? true : undefined,
    'aria-describedby': error ? ERROR_ID : undefined,
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(null)
          }}
          placeholder="you@example.com"
          autoComplete="email"
          required
          {...fieldErrorProps}
          className={FIELD_CLASS}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError(null)
            }}
            autoComplete="current-password"
            required
            {...fieldErrorProps}
            className={`${FIELD_CLASS} pr-12`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-0 top-0 size-11 text-muted-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          id={ERROR_ID}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-strong"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
