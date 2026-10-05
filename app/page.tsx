import Link from 'next/link'
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ChartNoAxesColumn,
  Compass,
  HandCoins,
  PiggyBank,
  ShieldCheck,
  Target,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'

import { Brand } from './auth-shell'
import { LanguageCornerButton } from './language'
import { SignedInMenu } from './signed-in-menu'

// The four parts of a life the app covers, in the order they are built. Each is
// built on the same loop of intent, reality and adjustment.
const NODES: { icon: LucideIcon; name: string; text: string; status: string; available: boolean }[] = [
  {
    icon: Wallet,
    name: m('Finance'),
    text: m('Income, allocations, a daily budget, savings chests, goals and debts.'),
    status: m('Available'),
    available: true,
  },
  {
    icon: UserRound,
    name: m('Personal'),
    text: m('What you do today and who you are becoming: tasks, goals, sessions and a journal.'),
    status: m('Available'),
    available: true,
  },
  {
    icon: Briefcase,
    name: m('Career'),
    text: m('Where you stand at work, what you want next by your own criteria, and how each opportunity compares.'),
    status: m('Available'),
    available: true,
  },
  {
    icon: Compass,
    name: m('Projection'),
    text: m('Later and maybe: ideas, a vision, seasons and letters to your future self.'),
    status: m('Planned'),
    available: false,
  },
]

const STEPS = [
  {
    title: m('Say what you intend'),
    text: m('Enter your income and where it should go: rent, subscriptions, savings, daily living.'),
  },
  {
    title: m('Live the day'),
    text: m('Each morning starts with one number: what today can afford. Record what you spend against it.'),
  },
  {
    title: m('Explain and adjust'),
    text: m('When a day goes off plan, note why. The review shows the pattern so the next month fits better.'),
  },
]

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarCheck,
    title: m('A daily budget'),
    text: m('Derived from your plan, with what is left and what you already spent today.'),
  },
  {
    icon: PiggyBank,
    title: m('Savings chests'),
    text: m('Keep what you do not spend, in a buffer or in chests you can lock until a date.'),
  },
  {
    icon: Target,
    title: m('Goals'),
    text: m('Give a chest a target and watch it fill. See how much of it was borrowed.'),
  },
  {
    icon: HandCoins,
    title: m('Debts and loans'),
    text: m('What you owe, what you are owed, with interest, due dates and repayments.'),
  },
  {
    icon: ChartNoAxesColumn,
    title: m('Review and history'),
    text: m('Planned against actual, by category, and every exception you explained.'),
  },
]

export default async function Home() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const isSignedIn = user !== null

  const primaryAction = isSignedIn ? (
    <Button asChild className="h-12 px-6 text-base">
      <Link href="/finance">
        {t('Open Finance')}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  ) : (
    <Button asChild className="h-12 px-6 text-base">
      <Link href="/signup">
        {t('Create your account')}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      {isSignedIn ? <SignedInMenu /> : <LanguageCornerButton />}

      {/* Right padding keeps the actions clear of the two round buttons */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 pr-28">
        <Brand />
        {isSignedIn ? null : (
          <nav className="flex items-center gap-2" aria-label={t('Account')}>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/login">{t('Sign in')}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/signup">{t('Sign up')}</Link>
            </Button>
          </nav>
        )}
      </header>

      <main className="space-y-16 py-10 sm:space-y-20 sm:py-16">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('One system for your life')}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t('Decide what you intend. See what really happened. Adjust.')}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t(
              'Personal Life Manager turns your plans into something you can check every day. It starts with your money: a plan for your income, and a clear number for what today can afford.',
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {primaryAction}
            {isSignedIn ? (
              user.role === 'ADMIN' ? (
                <Button asChild variant="outline" className="h-12 px-6 text-base">
                  <Link href="/admin">
                    <ShieldCheck aria-hidden="true" />
                    {t('Administration')}
                  </Link>
                </Button>
              ) : null
            ) : (
              <Button asChild variant="outline" className="h-12 px-6 text-base">
                <Link href="/login">{t('I already have an account')}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="h-12 px-4 text-base">
              <Link href="/learn">{t('How it works')}</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="nodes-title" className="space-y-5">
          <div>
            <h2 id="nodes-title" className="text-2xl font-semibold tracking-tight">
              {t('Four nodes, one life')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t(
                'Finance, Personal, Career and Projection: each is a node, built on the same loop of intent, reality and adjustment, and linked to the others. Finance, Personal and Career are the ones you can use today.',
              )}
            </p>
          </div>
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NODES.map(({ icon: Icon, name, text, status, available }) => (
              <li key={name}>
                <Card className={available ? 'h-full gap-0 border-primary/40 py-5' : 'h-full gap-0 py-5 opacity-80'}>
                  <CardContent className="space-y-3 px-5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={
                          available
                            ? 'flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground'
                            : 'flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground'
                        }
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <Badge variant={available ? 'default' : 'secondary'}>{t(status)}</Badge>
                    </div>
                    <p className="font-semibold">{t(name)}</p>
                    <p className="text-sm text-muted-foreground">{t(text)}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="loop-title" className="space-y-5">
          <h2 id="loop-title" className="text-2xl font-semibold tracking-tight">
            {t('How the finance node works')}
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map(({ title, text }, index) => (
              <li key={title}>
                <Card className="h-full gap-0 py-5">
                  <CardContent className="space-y-2 px-5">
                    <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                      {t('Step {number}', { number: String(index + 1) })}
                    </p>
                    <p className="font-semibold">{t(title)}</p>
                    <p className="text-sm text-muted-foreground">{t(text)}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-title" className="space-y-5">
          <h2 id="features-title" className="text-2xl font-semibold tracking-tight">
            {t('What you get')}
          </h2>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">{t(title)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(text)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card px-5 py-8 text-center shadow-sm sm:px-8 sm:py-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isSignedIn ? t('Your plan is waiting') : t('Start with this month')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {isSignedIn
              ? t("Pick up where you left off and see today's number.")
              : t(
                  'Create an account, enter your income and allocations, and get your first daily budget in a couple of minutes.',
                )}
          </p>
          <div className="mt-6 flex justify-center">{primaryAction}</div>
        </section>
      </main>

      <footer className="mt-auto flex flex-wrap justify-between gap-2 border-t py-6 text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Personal Life Manager</span>
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          {t('Privacy')}
        </Link>
      </footer>
    </div>
  )
}
