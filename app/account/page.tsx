import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { displayNameFromEmail } from '@/lib/greeting'
import { getT } from '@/lib/i18n/server'

import { SignOutButton } from '../sign-out-button'
import { SignedInMenu } from '../signed-in-menu'
import { AccountForm } from './account-form'

export const metadata: Metadata = {
  title: 'My account | Personal Life Manager',
}

export default async function AccountPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    redirect('/login?callbackUrl=/account')
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <SignedInMenu />
      {/* Right padding keeps the title clear of the account and theme buttons */}
      <header className="pr-28">
        <Link
          href="/finance"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t('Finance')}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('My account')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('How you appear in the app.')}</p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent>
          <AccountForm username={user.username ?? displayNameFromEmail(user.email) ?? ''} picture={user.picture} />
        </CardContent>
      </Card>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('Email')}</dt>
              <dd className="mt-0.5 font-medium break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('Role')}</dt>
              <dd className="mt-0.5">
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                  {user.role === 'ADMIN' ? t('Administrator') : t('User')}
                </Badge>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {t(
              'Administrators can see when you use the app and which features you use. They never see your amounts or what you write.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {user.role === 'ADMIN' ? (
              <Link
                href="/admin"
                className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                {t('Administration')}
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
