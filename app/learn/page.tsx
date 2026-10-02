import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarCheck,
  ChartNoAxesColumn,
  HandCoins,
  Layers,
  PiggyBank,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CURRENCY_CODE, MAX_BUDGET_DAYS_IN_MONTH } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'

import { Brand } from '../auth-shell'
import { LanguageCornerButton } from '../language'
import { SignedInMenu } from '../signed-in-menu'

export const metadata: Metadata = {
  title: 'How it works | Personal Life Manager',
}

// The example that runs through the page.
const EXAMPLE_INCOME = 300000
const EXAMPLE_DAILY_LIVING = 60000
const EXAMPLE_DAILY_BUDGET = EXAMPLE_DAILY_LIVING / MAX_BUDGET_DAYS_IN_MONTH
const EXAMPLE_SPENT = 1500

type Word = { term: string; text: string }

// The words of the app, grouped the way a month goes: plan, live the day,
// keep what is left, look back. One or two sentences each, on purpose.
const SECTIONS: { icon: LucideIcon; title: string; lead: string; words: Word[] }[] = [
  {
    icon: Layers,
    title: m('Your plan'),
    lead: m('You make it once, at setup. It says what comes in and where it should go.'),
    words: [
      { term: m('Income'), text: m('The money you receive, and the day of the month it usually arrives.') },
      {
        term: m('Allocation'),
        text: m('A share of your income set aside for one purpose: rent, a subscription, savings, daily living.'),
      },
      {
        term: m('Daily living'),
        text: m('The allocation for everyday spending: food, transport, small purchases. Your daily budget comes from it.'),
      },
    ],
  },
  {
    icon: CalendarCheck,
    title: m('Your day'),
    lead: m('Every day starts with one number. You record what you spend against it.'),
    words: [
      {
        term: m('Daily budget'),
        text: m('Your daily living allocation spread over 30 days. It is what one day can afford.'),
      },
      { term: m('Left today'), text: m('Your daily budget minus what you already spent today.') },
      {
        term: m('Overspend'),
        text: m('What you spent beyond the daily budget. It is not a fault, only something to explain.'),
      },
      {
        term: m('Exception'),
        text: m('The short reason you give for an overspend, such as an unexpected bill. Reasons make the review useful.'),
      },
    ],
  },
  {
    icon: PiggyBank,
    title: m('Your savings'),
    lead: m('What you do not spend is kept in chests, so it has a place and a purpose.'),
    words: [
      { term: m('Chest'), text: m('A place to keep money. You can create as many as you need, one per purpose.') },
      {
        term: m('Buffer'),
        text: m('Where what is left of each day goes, on its own. Once a week it is emptied into your Base Chest.'),
      },
      {
        term: m('Base Chest'),
        text: m('Your main chest. Income that no allocation claims lands here, and so does the Buffer every week.'),
      },
      {
        term: m('Secure chest'),
        text: m('A chest you can lock until a date, so the money stays out of reach until then.'),
      },
      {
        term: m('Goal'),
        text: m('A target for a chest, such as a phone or an emergency fund. It is reached when the chest holds the target.'),
      },
    ],
  },
  {
    icon: HandCoins,
    title: m('Borrowing and lending'),
    lead: m('Money that is not really yours yet, or not with you for now, is tracked apart.'),
    words: [
      {
        term: m('Debt'),
        text: m('Money you borrowed. It goes into the Debts Chest, apart from your savings, until you repay it.'),
      },
      {
        term: m('Loan'),
        text: m('Money you lent to someone. When it comes back, it returns to your Base Chest.'),
      },
    ],
  },
  {
    icon: ChartNoAxesColumn,
    title: m('Looking back'),
    lead: m('Once in a while, compare what you planned with what happened, then adjust.'),
    words: [
      {
        term: m('Review'),
        text: m('Planned against actual for the week, the month or the year, with where the money went.'),
      },
      { term: m('History'), text: m('Everything you recorded, newest first.') },
    ],
  },
]

const GOOD_TO_KNOW = [
  m('You are asked to confirm your income when it arrives. Only then do your planned savings go into your chests.'),
  m('The plan covers 30 days. On a 31st, the day’s budget is taken from your Buffer and Base Chest.'),
  m('Nothing is connected to your bank. The app only knows what you record.'),
]

export default async function LearnPage() {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const isSignedIn = user !== null
  const money = (value: number) => `${t.amount(value)} ${CURRENCY_CODE}`

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
      {isSignedIn ? <SignedInMenu /> : <LanguageCornerButton />}

      {/* Right padding keeps the brand clear of the two round buttons */}
      <header className="py-4 pr-28">
        <Brand />
      </header>

      <main className="space-y-8 py-6 sm:py-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('A five-minute read')}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t('How it works, in plain words')}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {t('The few ideas the app is built on. Read them once and every screen will make sense.')}
          </p>
        </section>

        <Card className="gap-0 py-5">
          <CardContent className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="size-5 text-muted-foreground" aria-hidden="true" />
              {t('The whole idea, with one example')}
            </h2>
            <ol className="space-y-2 text-sm">
              <li>
                {t('You earn {income} a month and set {living} aside for daily living.', {
                  income: money(EXAMPLE_INCOME),
                  living: money(EXAMPLE_DAILY_LIVING),
                })}
              </li>
              <li>
                {t('That gives you {budget} to spend each day.', { budget: money(EXAMPLE_DAILY_BUDGET) })}
              </li>
              <li>
                {t('Today you spend {spent}. The {left} left can go into a chest.', {
                  spent: money(EXAMPLE_SPENT),
                  left: money(EXAMPLE_DAILY_BUDGET - EXAMPLE_SPENT),
                })}
              </li>
              <li>{t('Day after day, the chests fill up and your goals get closer.')}</li>
            </ol>
          </CardContent>
        </Card>

        {SECTIONS.map(({ icon: Icon, title, lead, words }) => (
          <section key={title} aria-labelledby={`learn-${title}`} className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card">
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <div>
                <h2 id={`learn-${title}`} className="text-xl font-semibold tracking-tight">
                  {t(title)}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(lead)}</p>
              </div>
            </div>
            <dl className="divide-y rounded-xl border bg-card px-4 shadow-sm">
              {words.map(({ term, text }) => (
                <div key={term} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                  <dt className="text-sm font-semibold">{t(term)}</dt>
                  <dd className="text-sm text-muted-foreground">{t(text)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section aria-labelledby="learn-good-to-know" className="space-y-3">
          <h2 id="learn-good-to-know" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Target className="size-5 text-muted-foreground" aria-hidden="true" />
            {t('Good to know')}
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
            {GOOD_TO_KNOW.map((text) => (
              <li key={text}>{t(text)}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card px-5 py-6 text-center shadow-sm">
          <p className="text-base font-semibold">{t('That is all you need to start.')}</p>
          <div className="mt-4 flex justify-center">
            <Button asChild className="h-12 px-6 text-base">
              <Link href={isSignedIn ? '/finance' : '/signup'}>
                {isSignedIn ? t('Open Finance') : t('Create your account')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
