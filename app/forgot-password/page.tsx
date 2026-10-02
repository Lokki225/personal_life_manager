import type { Metadata } from 'next'
import Link from 'next/link'

import { canEmailResetLinks } from '@/application/account/passwordReset'
import { getT } from '@/lib/i18n/server'

import { AuthShell } from '../auth-shell'
import { ForgotPasswordForm } from './forms'

export const metadata: Metadata = {
  title: 'Forgot password | Personal Life Manager',
}

export default async function ForgotPasswordPage() {
  const t = await getT()

  return (
    <AuthShell
      title={t('Forgot your password?')}
      subtitle={t('Enter the email of your account to receive a link to choose a new one.')}
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t('Back to sign in')}
        </Link>
      }
    >
      <ForgotPasswordForm canEmail={canEmailResetLinks()} />
    </AuthShell>
  )
}
