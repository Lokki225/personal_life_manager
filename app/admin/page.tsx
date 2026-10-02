import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, EyeOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getAdminDashboard, type FeatureKey } from '@/application/account/adminDashboard'
import type { ActivityStatus } from '@/domain/account/activity'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { fullName } from '@/lib/greeting'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { ColumnChart } from '../finance/charts'
import { Meter } from '../finance/money'
import { LANGUAGE_NAMES } from '../language-names'
import { SignedInMenu } from '../signed-in-menu'
import { ResetLinkButton } from './reset-link'
import { RoleSelect } from './role-select'

export const metadata: Metadata = {
  title: 'Administration | Personal Life Manager',
}

const STATUS: Record<ActivityStatus, { label: string; dot: string }> = {
  active: { label: m('Active this week'), dot: 'bg-success' },
  quiet: { label: m('Quiet'), dot: 'bg-warning' },
  gone: { label: m('Away for over a month'), dot: 'bg-muted-foreground/50' },
  never: { label: m('Never active'), dot: 'bg-muted-foreground/50' },
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  expenses: m('Recording expenses'),
  savings: m('Saving what is left of a day'),
  ownChests: m('Creating their own chests'),
  goals: m('Goals'),
  debts: m('Debts and loans'),
  explanations: m('Explaining an overspend'),
  incomeConfirmations: m('Confirming an income'),
}

// A step or a feature: its name, how many people, and that as a bar.
function ShareRow({ label, count, total, of }: { label: string; count: number; total: number; of: string }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-semibold">{count}</span>
          <span className="text-muted-foreground"> {of}</span>
        </span>
      </div>
      <Meter value={total > 0 ? (count / total) * 100 : 0} label={label} className="h-1.5" />
    </li>
  )
}

export default async function AdminPage() {
  const [actor, t] = await Promise.all([getSignedInUser(), getT()])

  if (!actor) {
    redirect('/login?callbackUrl=/admin')
  }

  // The dashboard is for administrators. Everyone else goes to their own pages.
  if (actor.role !== 'ADMIN') {
    redirect('/finance')
  }

  const dashboard = await getAdminDashboard(actor)
  const total = dashboard.users.length
  const of = t('of {total}', { total: String(total) })
  const dateFormatter = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric' })
  const dayFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'short', day: 'numeric', month: 'short' })

  const stats = [
    { label: t('Accounts'), value: total },
    { label: t('Active this week'), value: dashboard.activeThisWeek },
    { label: t('With a plan set up'), value: dashboard.funnel.planSetUp },
    { label: t('Using French'), value: dashboard.languages.fr },
  ]

  const steps = [
    { label: t('Signed up'), count: dashboard.funnel.signedUp },
    { label: t('Finished the setup'), count: dashboard.funnel.planSetUp },
    { label: t('Recorded a first expense'), count: dashboard.funnel.firstExpense },
    { label: t('Still recording after a week'), count: dashboard.funnel.afterAWeek },
    { label: t('Still recording after a month'), count: dashboard.funnel.afterAMonth },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
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
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t('Administration')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('Who uses the app, and how.')}</p>
      </header>

      <p className="flex items-start gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
        <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('This page shows counts and dates only. No amounts and no notes appear here.')}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">{t('People recording something, per day')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('The last 30 days.')}</p>
          </div>
          <ColumnChart
            points={dashboard.activePerDay.map(({ day, users }, index) => ({
              label: String(day.getDate()),
              showLabel: index % 7 === 0 || index === dashboard.activePerDay.length - 1,
              title: dayFormatter.format(day),
              value: users,
            }))}
            label={t('People recording something, per day')}
            unit={t('people')}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-0 py-5">
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">{t('How far people get')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('A big drop between two steps shows where people get stuck.')}</p>
            </div>
            <ol className="space-y-3">
              {steps.map((step) => (
                <ShareRow key={step.label} label={step.label} count={step.count} total={total} of={of} />
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="gap-0 py-5">
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">{t('What people use')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('People who used each feature at least once.')}</p>
            </div>
            <ul className="space-y-3">
              {dashboard.features.map((feature) => (
                <ShareRow
                  key={feature.key}
                  label={t(FEATURE_LABELS[feature.key])}
                  count={feature.users}
                  total={total}
                  of={of}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-2">
        <CardContent className="px-4">
          <h2 className="py-3 text-base font-semibold">{t('Accounts')}</h2>
          <ul className="divide-y border-t">
            {dashboard.users.map((user) => {
              const name = fullName(user)
              const isSelf = user.id === actor.id
              const status = STATUS[user.status]
              const language = user.locale === 'fr' || user.locale === 'en' ? LANGUAGE_NAMES[user.locale] : null

              return (
                <li key={user.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4">
                  <div className="min-w-0 flex-1 basis-56 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{name}</span>
                      {isSelf ? <Badge variant="secondary">{t('You')}</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <p className="flex items-center gap-1.5 text-xs">
                      <span className={cn('size-2 shrink-0 rounded-full', status.dot)} aria-hidden="true" />
                      {t(status.label)}
                      {user.lastActiveAt ? (
                        <span className="text-muted-foreground">
                          · {t('last on {date}', { date: dateFormatter.format(user.lastActiveAt) })}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        t('Joined {date}', { date: dateFormatter.format(user.createdAt) }),
                        user.hasPlan ? t('Plan set up') : t('No plan yet'),
                        language,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        t.plural(user.activeDays, '{count} active day in 30', '{count} active days in 30'),
                        t.plural(user.usage.expenses, '{count} expense', '{count} expenses'),
                        t.plural(user.usage.goals, '{count} goal', '{count} goals'),
                        t.plural(user.usage.debts, '{count} debt', '{count} debts'),
                      ].join(' · ')}
                    </p>
                  </div>
                  <div className="w-40 shrink-0">
                    {isSelf ? (
                      // Nobody changes their own role, so an administrator always remains.
                      <Badge>{t('Administrator')}</Badge>
                    ) : (
                      <RoleSelect userId={user.id} name={name} role={user.role} />
                    )}
                  </div>
                  <ResetLinkButton userId={user.id} name={name} />
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
