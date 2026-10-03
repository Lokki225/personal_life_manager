import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { feedbackRepository } from '@/infrastructure/repositories/feedbackRepository'
import { getT } from '@/lib/i18n/server'

import { SignedInMenu } from '../signed-in-menu'
import { FeedbackForm } from './feedback-form'

export const metadata: Metadata = {
  title: 'Your opinion | Personal Life Manager',
}

export default async function FeedbackPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    redirect('/login?callbackUrl=/feedback')
  }

  const wantsNews = await feedbackRepository.wantsNews(user.id)

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
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('Your opinion')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('The app is young and grows with what its users say. Tell us what works, what does not, and what you would like.')}
        </p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent>
          <FeedbackForm wantsNews={wantsNews} />
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        {t('Only the administrators read it, with your name and email so they can answer you.')}
      </p>
    </main>
  )
}
