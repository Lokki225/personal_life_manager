import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getReview } from '@/application/finance/getReview'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m, type Translator } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'
import { SaveSnapshot } from '@/components/offline/save-snapshot'

import { categoryColor, categoryStyle } from '../categories'
import { chartPoints } from '../chart-data'
import { ColumnChart, LineChart } from '../charts'
import { conditionLabel, operatorLabel } from '../goal-labels'
import { Meter, Money } from '../money'
import { ensureDaysSettled } from '../settle'

const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

type ReviewPeriod = (typeof PERIOD_OPTIONS)[number]

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  day: m('Today'),
  week: m('This week'),
  month: m('This month'),
  year: m('This year'),
}

// Parts of a whole: one bar cut into the categories, then each one named with
// its amount and share, so nothing is read from colour alone.
function Breakdown({
  title,
  entries,
  empty,
  t,
}: {
  title: string
  entries: { category: string; total: number }[]
  empty: string
  t: Translator
}) {
  const total = entries.reduce((sum, entry) => sum + entry.total, 0)

  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {total > 0 ? (
            <p className="text-sm text-muted-foreground">
              <Money value={total} className="font-medium text-foreground" /> {t('in total')}
            </p>
          ) : null}
        </div>
        {total > 0 ? (
          <>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              {entries.map((entry) => (
                <span
                  key={entry.category}
                  className={cn('min-w-1', categoryColor(entry.category))}
                  style={{ flexGrow: entry.total, flexBasis: 0 }}
                />
              ))}
            </div>
            <ul className="space-y-2.5">
              {entries.map((entry) => {
                const { label, icon: Icon } = categoryStyle(entry.category)

                return (
                  <li key={entry.category} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn('size-2.5 shrink-0 rounded-full', categoryColor(entry.category))}
                        aria-hidden="true"
                      />
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{t(label)}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round((entry.total / total) * 100)}%
                      </span>
                      <Money value={entry.total} className="font-semibold" />
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default async function FinanceReviewPage({ searchParams }: PageProps<'/finance/review'>) {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!userId) {
    redirect('/login')
  }

  const period = String((await searchParams).period ?? 'month')
  const selectedPeriod: ReviewPeriod = PERIOD_OPTIONS.includes(period as ReviewPeriod)
    ? (period as ReviewPeriod)
    : 'month'

  const review = await getReview({ userId, period: selectedPeriod })
  const isOver = review.remaining < 0
  const usedShare = review.plannedBudget > 0 ? (review.actualSpent / review.plannedBudget) * 100 : 0

  const trend = review.trend
  const chartPeriod = selectedPeriod === 'day' ? null : selectedPeriod
  const byMonth = selectedPeriod === 'year'
  const spendingTitle = byMonth ? t('Spending per month') : t('Spending per day')
  const spentInPeriod = trend ? trend.spent.reduce((sum, amount) => sum + amount, 0) : 0
  const bucketsOver = trend && trend.budget > 0 ? trend.spent.filter((amount) => amount > trend.budget).length : 0
  const savedNow = trend?.saved.findLast((value) => value !== null) ?? 0
  const savedAtStart = trend?.saved.find((value) => value !== null) ?? 0

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <SaveSnapshot
        snapshotKey="finance.review"
        data={{
          period: review.period,
          plannedBudget: review.plannedBudget,
          actualSpent: review.actualSpent,
          remaining: review.remaining,
          actualSavings: review.actualSavings,
          exceptionCount: review.exceptionCount,
          categories: review.categoryBreakdown.map((c) => ({ category: c.category, total: c.total })),
          goals: review.goals.map((g) => ({ name: g.name, satisfied: g.satisfied })),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('Review')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('How the plan held up, and where it did not.')}</p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">{t('This month against the plan')}</h2>
          <p className={cn('text-2xl font-semibold tracking-tight', isOver && 'text-destructive-strong')}>
            <Money value={Math.abs(review.remaining)} />
            <span className="ml-2 text-sm font-normal text-muted-foreground">{isOver ? t('over budget') : t('left')}</span>
          </p>
          <Meter value={usedShare} tone={isOver ? 'danger' : 'success'} label={t("Share of the month's budget spent")} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('Planned')}</dt>
              <dd className="font-semibold">
                <Money value={review.plannedBudget} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('Spent')}</dt>
              <dd className="font-semibold">
                <Money value={review.actualSpent} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('Saved in chests')}</dt>
              <dd className="font-semibold">
                <Money value={review.actualSavings + review.buffer} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('Exceptions')}</dt>
              <dd className="font-semibold">{review.exceptionCount}</dd>
            </div>
          </dl>
          {review.paidFromChests > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('Paid from chests, outside the budget:')}{' '}
              <Money value={review.paidFromChests} className="font-medium text-foreground" />
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t('Charts for')}
        </h2>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {PERIOD_OPTIONS.map((option) => (
            <li key={option} className="shrink-0">
              <Link
                href={`/finance/review?period=${option}`}
                aria-current={selectedPeriod === option ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                  selectedPeriod === option
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground hover:text-foreground',
                )}
              >
                {t(PERIOD_LABELS[option])}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {trend && chartPeriod ? (
        <Card className="gap-0 py-5">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base font-semibold">{spendingTitle}</h2>
              <p className="text-sm text-muted-foreground">
                <Money value={spentInPeriod} className="font-medium text-foreground" /> {t('in total')}
              </p>
            </div>
            <ColumnChart
              points={chartPoints(chartPeriod, trend.buckets, trend.spent, t.intl)}
              label={spendingTitle}
              reference={{ value: trend.budget, label: t('Budget {amount}', { amount: trend.budget }) }}
            />
            {trend.budget > 0 ? (
              <p className="text-sm text-muted-foreground">
                {bucketsOver === 0
                  ? byMonth
                    ? t('No month went over the budget.')
                    : t('No day went over the budget.')
                  : byMonth
                    ? t.plural(
                        bucketsOver,
                        '{count} month went over the budget line.',
                        '{count} months went over the budget line.',
                      )
                    : t.plural(
                        bucketsOver,
                        '{count} day went over the budget line.',
                        '{count} days went over the budget line.',
                      )}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Breakdown
        title={t('Spending by category')}
        entries={review.categoryBreakdown}
        empty={t('No expenses in this period.')}
        t={t}
      />

      {trend && chartPeriod ? (
        <Card className="gap-0 py-5">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base font-semibold">{t('Saved in chests')}</h2>
              <p className="text-sm text-muted-foreground">
                <Money value={savedNow} className="font-medium text-foreground" /> {t('now,')}{' '}
                {savedNow >= savedAtStart ? t('up') : t('down')} <Money value={Math.abs(savedNow - savedAtStart)} />
              </p>
            </div>
            <LineChart
              points={chartPoints(chartPeriod, trend.buckets, trend.saved, t.intl)}
              label={t('Saved in chests over time')}
            />
          </CardContent>
        </Card>
      ) : null}

      <Breakdown
        title={t('Overspend by category')}
        entries={review.exceptionBreakdown}
        empty={t('No exceptions in this period.')}
        t={t}
      />

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">{t('Goals')}</h2>
          {review.goals.length > 0 ? (
            <ul className="divide-y">
              {review.goals.map((goal) => (
                <li key={goal.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">
                      <span className="line-clamp-2">{goal.name}</span>
                    </p>
                    <Badge variant={goal.satisfied ? 'default' : 'secondary'} className="shrink-0">
                      {goal.satisfied ? t('On track') : t('Not yet')}
                    </Badge>
                  </div>
                  <ul className="space-y-1.5">
                    {goal.conditionResults.map((result, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                            result.satisfied ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {result.satisfied ? (
                            <Check className="size-3.5" aria-label={t('Met')} />
                          ) : (
                            <X className="size-3.5" aria-label={t('Not met')} />
                          )}
                        </span>
                        <span>
                          {conditionLabel(t, result)}
                          {t(': ')}
                          <span className="font-medium">{t.amount(result.actual)}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            ({t(operatorLabel(result.operator))} {t.amount(result.target)})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('No goals yet.')}{' '}
              <Link href="/finance/goals" className="font-medium text-foreground underline underline-offset-4">
                {t('Create one')}
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
