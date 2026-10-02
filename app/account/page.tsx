import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Download } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { userRepository } from '@/infrastructure/repositories/userRepository'
import { getT } from '@/lib/i18n/server'

import { SignOutButton } from '../sign-out-button'
import { SignedInMenu } from '../signed-in-menu'
import { CredentialsForm, ProfileForm } from './account-form'

export const metadata: Metadata = {
  title: 'My account | Personal Life Manager',
}

// A date as a date input wants it: "1998-05-12".
const dateInputValue = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : ''

export default async function AccountPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    redirect('/login?callbackUrl=/account')
  }

  const profile = await userRepository.getProfile(user.id)

  if (!profile) {
    redirect('/login?callbackUrl=/account')
  }

  // Accounts made before first and last names existed typed everything into
  // one field. Offer it split, for the person to correct.
  const [guessedFirstName = '', ...guessedLastNames] = profile.firstName ? [] : (profile.username ?? '').split(/\s+/)
  const hasNames = Boolean(profile.firstName)

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
        <p className="mt-1 text-sm text-muted-foreground">{t('Who you are, and how you sign in.')}</p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold">{t('Profile')}</h2>
          <ProfileForm
            profile={{
              firstName: profile.firstName ?? guessedFirstName,
              lastName: profile.lastName ?? guessedLastNames.join(' '),
              username: hasNames ? (profile.username ?? '') : '',
              bio: profile.bio ?? '',
              occupation: profile.occupation ?? '',
              phone: profile.phone ?? '',
              country: profile.country ?? '',
              city: profile.city ?? '',
              birthDate: dateInputValue(profile.birthDate),
              timeZone: profile.timeZone ?? '',
              picture: profile.picture,
            }}
          />
        </CardContent>
      </Card>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">{t('Sign-in details')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('The email and password you sign in with.')}</p>
          </div>
          <CredentialsForm email={profile.email} />
        </CardContent>
      </Card>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">{t('Your data')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Download everything you recorded as one file: your own backup, yours to keep.')}
            </p>
          </div>
          {/* A plain link: the browser downloads the file the address returns. */}
          <a
            href="/account/export"
            download
            className="inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            <Download className="size-4" aria-hidden="true" />
            {t('Export my data')}
          </a>
        </CardContent>
      </Card>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('Role')}</span>
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                {user.role === 'ADMIN' ? t('Administrator') : t('User')}
              </Badge>
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
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'Administrators can see your name, your email, when you use the app and which features you use. They never see your amounts, what you write, or the rest of your profile.',
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
