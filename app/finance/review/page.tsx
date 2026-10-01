import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getReview } from '@/application/finance/getReview'
import { formatAmount } from '@/domain/finance/calculations'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { cn } from '@/lib/utils'

import { categoryStyle } from '../categories'
import { measurementLabel, operatorLabel } from '../goal-labels'
import { Meter, Money } from '../money'

const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

type ReviewPeriod = (typeof PERIOD_OPTIONS)[number]

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

function Breakdown({
  title,
  entries,
  empty,
}: {
  title: string
  entries: { category: string; total: number }[]
  empty: string
}) {
  const largest = Math.max(...entries.map((entry) => entry.total), 1)

  return (
    <Card className="gap-0 py-5">
      <CardContent className="space-y-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {entries.length > 0 ? (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const { label, icon: Icon } = categoryStyle(entry.category)

              return (
                <li key={entry.category} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </span>
                    <Money value={entry.total} className="font-semibold" />
                  </div>
                  <Meter value={(entry.total / largest) * 100} label={`${label} share`} className="h-1.5" />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default async function FinanceReviewPage({ searchParams }: PageProps<'/finance/review'>) {
  const userId = await getSignedInUserId()

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

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">How the plan held up, and where it did not.</p>
      </header>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">This month against the plan</h2>
          <p className={cn('text-2xl font-semibold tracking-tight', isOver && 'text-destructive-strong')}>
            <Money value={Math.abs(review.remaining)} />
            <span className="ml-2 text-sm font-normal text-muted-foreground">{isOver ? 'over budget' : 'left'}</span>
          </p>
          <Meter value={usedShare} tone={isOver ? 'danger' : 'success'} label="Share of the month's budget spent" />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Planned</dt>
              <dd className="font-semibold">
                <Money value={review.plannedBudget} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Spent</dt>
              <dd className="font-semibold">
                <Money value={review.actualSpent} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Saved in chests</dt>
              <dd className="font-semibold">
                <Money value={review.actualSavings + review.buffer} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Exceptions</dt>
              <dd className="font-semibold">{review.exceptionCount}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="gap-0 py-5">
        <CardContent className="space-y-3">
          <h2 className="text-base font-semibold">Goals</h2>
          {review.goals.length > 0 ? (
            <ul className="divide-y">
              {review.goals.map((goal) => (
                <li key={goal.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">
                      <span className="line-clamp-2">{goal.name}</span>
                    </p>
                    <Badge variant={goal.satisfied ? 'default' : 'secondary'} className="shrink-0">
                      {goal.satisfied ? 'On track' : 'Not yet'}
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
                            <Check className="size-3.5" aria-label="Met" />
                          ) : (
                            <X className="size-3.5" aria-label="Not met" />
                          )}
                        </span>
                        <span>
                          {measurementLabel(result.measurement)}:{' '}
                          <span className="font-medium">{formatAmount(result.actual)}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            ({operatorLabel(result.operator)} {formatAmount(result.target)})
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
              No goals yet.{' '}
              <Link href="/finance/goals" className="font-medium text-foreground underline underline-offset-4">
                Create one
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Breakdown for
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
                {PERIOD_LABELS[option]}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Breakdown title="Spending by category" entries={review.categoryBreakdown} empty="No expenses in this period." />
      <Breakdown
        title="Overspend by category"
        entries={review.exceptionBreakdown}
        empty="No exceptions in this period."
      />
    </main>
  )
}
