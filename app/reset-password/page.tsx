import type { Metadata } from 'next'
import Link from 'next/link'

import { getT } from '@/lib/i18n/server'

import { AuthShell } from '../auth-shell'
import { ResetPasswordForm } from '../forgot-password/forms'

export const metadata: Metadata = {
  title: 'New password | Personal Life Manager',
  // The address holds a secret: it must not be passed on to other sites.
  referrer: 'no-referrer',
}

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const [t, params] = await Promise.all([getT(), searchParams])
  const token = typeof params.token === 'string' ? params.token : ''

  return (
    <AuthShell
      title={t('Choose a new password')}
      subtitle={t('It replaces the old one as soon as you save.')}
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t('Back to sign in')}
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="mt-8 rounded-lg border bg-card px-3 py-3 text-sm">
          {t('This link is not valid.')}{' '}
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            {t('Ask for a new one')}
          </Link>
          .
        </p>
      )}
    </AuthShell>
  )
}
