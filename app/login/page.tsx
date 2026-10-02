import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'

import { AuthShell } from '../auth-shell'
import { safeCallbackUrl } from './callbackUrl'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in | Personal Life Manager',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl)

  if (await getSignedInUserId()) {
    redirect(callbackUrl)
  }

  const t = await getT()

  return (
    <AuthShell
      title={t('Welcome back')}
      subtitle={t("Sign in to see today's budget.")}
      footer={
        <>
          {t('New here?')}{' '}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            {t('Create an account')}
          </Link>
        </>
      }
    >
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  )
}
