import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'

import { AuthShell } from '../auth-shell'
import { SignUpForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Create an account | Personal Life Manager',
}

export default async function SignUpPage() {
  if (await getSignedInUserId()) {
    redirect('/learn')
  }

  const t = await getT()

  return (
    <AuthShell
      title={t('Create your account')}
      subtitle={t('Then set up your plan in a couple of minutes.')}
      footer={
        <>
          {t('Already have an account?')}{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            {t('Sign in')}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  )
}
