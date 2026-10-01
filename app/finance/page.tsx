import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, ChevronRight, Lock, Target, TriangleAlert, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { hasSetupPlan } from '@/application/finance/createSetupPlan'
import { getHistory } from '@/application/finance/getHistory'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { expectedSpendToDate, getDailyFinanceStatus } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { displayNameFromEmail, greetingFor } from '@/lib/greeting'
import { cn } from '@/lib/utils'

import { categoryStyle, EVENT_ICONS } from './categories'
import { Meter, Money } from './money'
import { AddExpenseDrawer, ExceptionDrawer, SaveRemainingDrawer } from './today-actions'

const STATUS_STYLES = {
  emerald: { dot: 'bg-success', meter: 'success' },
  amber: { dot: 'bg-warning', meter: 'warning' },
  rose: { dot: 'bg-destructive', meter: 'danger' },
} as const

const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {linkLabel}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

export default async function FinanceTodayPage() {
  const user = await getSignedInUser()

  if (!user) {
    redirect('/login')
  }

  const userId = user.id

  if (!(await hasSetupPlan(userId))) {
    redirect('/finance/setup')
  }

  const now = new Date()
  const [state, monthEvents] = await Promise.all([
    recomputeFinanceState({ userId, referenceDate: now }),
    getHistory({ userId, period: 'month', referenceDate: now }),
  ])

  const greeting = greetingFor(now)
  const displayName = displayNameFromEmail(user.email)

  const hasDailyBudget = state.dailyBudget > 0
  const isOver = state.dailyOverspend > 0
  const spendingStatus = getDailyFinanceStatus(state.dailyBudget, state.dailySpent)
  // Saving first and spending later can put the day over even when spending
  // alone is within budget.
  const status = isOver ? { label: 'Overspent', tone: 'rose' as const } : spendingStatus
  const statusStyle = STATUS_STYLES[status.tone]
  const availableToSave = Math.floor(state.dailySaving)

  const categoryTotals = Object.entries(
    state.dailyExpenses.reduce<Record<string, number>>((totals, expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount
      return totals
    }, {}),
  ).sort((left, right) => right[1] - left[1])

  const expectedByToday = expectedSpendToDate(state.periodBudget, now)
  const paceGap = expectedByToday - state.monthlySpent
  const monthOver = state.monthlyRemaining < 0

  const allocatedShare = state.incomeTotal > 0 ? (state.allocationTotal / state.incomeTotal) * 100 : 0
  const unallocated = state.incomeTotal - state.allocationTotal

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      {/* Right padding keeps the title clear of the fixed theme toggle */}
      <header className="space-y-4 pr-14">
        <p className="flex min-h-11 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Personal Life Manager</span>
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {displayName ? `${greeting.salutation}, ${displayName}!` : `${greeting.salutation}!`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dayFormatter.format(now)} · {greeting.note}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="gap-0 py-5">
            <CardContent className="space-y-5">
              {hasDailyBudget ? (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {isOver ? 'Over today' : 'Left today'}
                      </p>
                      <Badge variant="outline" className="gap-1.5">
                        <span className={cn('size-2 rounded-full', statusStyle.dot)} aria-hidden="true" />
                        {status.label}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-[clamp(2rem,11vw,3rem)] leading-none font-semibold tracking-tight',
                        isOver && 'text-destructive-strong',
                      )}
                    >
                      <Money value={isOver ? state.dailyOverspend : state.dailyRemaining} />
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Meter
                      value={((state.dailySpent + state.savedToday) / state.dailyBudget) * 100}
                      tone={statusStyle.meter}
                      label="Share of today's budget used"
                    />
                    <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                      <span>
                        Spent <Money value={state.dailySpent} className="font-medium text-foreground" />
                      </span>
                      <span>
                        Budget <Money value={state.dailyBudget} className="font-medium text-foreground" />
                      </span>
                    </p>
                    {state.savedToday > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        <Money value={state.savedToday} className="font-medium text-foreground" /> saved from
                        today&apos;s budget.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No daily budget yet</p>
                  <p className="mt-2 text-sm">
                    Your plan has no &quot;Daily living&quot; allocation, so there is nothing to spread over the
                    month. Expenses are still recorded.
                  </p>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 sm:[&>*:only-child]:col-span-2">
                <AddExpenseDrawer />
                {isOver && !state.overspendExplained ? <ExceptionDrawer overspend={state.dailyOverspend} /> : null}
                {!isOver && availableToSave >= 1 ? (
                  <SaveRemainingDrawer
                    available={availableToSave}
                    chests={state.chests.map((chest) => ({ id: chest.id, name: chest.name }))}
                  />
                ) : null}
              </div>
              {isOver && state.overspendExplained ? (
                <p className="text-sm text-muted-foreground">Today&apos;s overspend is explained. See it in Review.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title="Spent today" />
              {state.dailyExpenses.length > 0 ? (
                <>
                  {categoryTotals.length > 1 ? (
                    <ul className="flex flex-wrap gap-2">
                      {categoryTotals.map(([category, total]) => (
                        <li key={category}>
                          <Badge variant="secondary" className="gap-1.5 py-1">
                            {categoryStyle(category).label}
                            <Money value={total} className="font-semibold" />
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="divide-y">
                    {state.dailyExpenses.map((expense) => {
                      const { label, icon: Icon } = categoryStyle(expense.category)

                      return (
                        <li key={expense.id} className="flex items-center gap-3 py-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{expense.description || label}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {expense.projectName ? `${label} · ${expense.projectName}` : label}
                            </p>
                          </div>
                          <Money value={expense.amount} sign="-" className="text-sm font-semibold" />
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing spent yet today.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {state.exceptionCount > 0 ? (
            <Link
              href="/finance/review"
              className="flex min-h-11 items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
            >
              <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="flex-1">
                {state.exceptionCount} {state.exceptionCount === 1 ? 'exception' : 'exceptions'} this month. Review
                what went off plan.
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : null}

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title="This month" href="/finance/review" linkLabel="Review" />
              {state.periodBudget > 0 ? (
                <>
                  <p className={cn('text-2xl font-semibold tracking-tight', monthOver && 'text-destructive-strong')}>
                    <Money value={Math.abs(state.monthlyRemaining)} />
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {monthOver ? 'over budget' : 'left'}
                    </span>
                  </p>
                  <Meter
                    value={(state.monthlySpent / state.periodBudget) * 100}
                    tone={monthOver ? 'danger' : paceGap < 0 ? 'warning' : 'success'}
                    marker={(expectedByToday / state.periodBudget) * 100}
                    label="Share of the month's budget spent"
                  />
                  <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                    <span>
                      Spent <Money value={state.monthlySpent} className="font-medium text-foreground" />
                    </span>
                    <span>
                      of <Money value={state.periodBudget} className="font-medium text-foreground" />
                    </span>
                  </p>
                  <p className="text-sm">
                    {paceGap >= 0 ? (
                      <>
                        <Money value={paceGap} className="font-semibold" /> under the pace for today&apos;s date.
                      </>
                    ) : (
                      <>
                        <Money value={-paceGap} className="font-semibold" /> over the pace for today&apos;s date.
                      </>
                    )}{' '}
                    <span className="text-muted-foreground">The line marks where even spending would be.</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Money value={state.monthlySpent} className="font-medium text-foreground" /> spent this month.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title="Savings" href="/finance/chests" linkLabel="Manage" />
              <dl className="grid gap-3 min-[400px]:grid-cols-2">
                <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 min-[400px]:block">
                  <dt className="text-xs text-muted-foreground">Total saved</dt>
                  <dd className="text-lg font-semibold min-[400px]:mt-0.5">
                    <Money value={state.totalSaved} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 min-[400px]:block">
                  <dt className="text-xs text-muted-foreground">Of which buffer</dt>
                  <dd className="text-lg font-semibold min-[400px]:mt-0.5">
                    <Money value={state.buffer} />
                  </dd>
                </div>
              </dl>
              {state.chests.length > 0 ? (
                <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
                  {state.chests.map((chest) => (
                    <li key={chest.id} className="min-w-32 shrink-0 rounded-lg border px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {chest.type === 'SECURE' ? <Lock className="size-3" aria-label="Secure chest" /> : null}
                        <span className="truncate">{chest.name}</span>
                      </p>
                      <p className={cn('mt-1 text-sm font-semibold', chest.balance < 0 && 'text-destructive-strong')}>
                        <Money value={chest.balance} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your chests are created the first time you save what is left of a day.
                </p>
              )}
            </CardContent>
          </Card>

          {state.goals.length > 0 ? (
            <Card className="gap-0 py-5">
              <CardContent className="space-y-3">
                <SectionHeading title="Goals" href="/finance/goals" linkLabel="All goals" />
                <ul className="space-y-4">
                  {state.goals.map((goal) => {
                    const balance = goal.conditionResults.find(
                      (result) => result.measurement === 'chest_balance' && result.target > 0,
                    )

                    return (
                      <li key={goal.id} className="space-y-2">
                        <div className="flex items-start justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-start gap-2 font-medium">
                            <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="line-clamp-2">{goal.name}</span>
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {goal.satisfied ? 'Reached' : 'In progress'}
                          </span>
                        </div>
                        {balance ? (
                          <>
                            <Meter
                              value={(balance.actual / balance.target) * 100}
                              tone={goal.satisfied ? 'success' : 'primary'}
                              label={`Progress towards ${goal.name}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              <Money value={balance.actual} className="font-medium text-foreground" /> of{' '}
                              <Money value={balance.target} />
                            </p>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title="Recent activity" href="/finance/history" linkLabel="History" />
              {monthEvents.length > 0 ? (
                <ul className="divide-y">
                  {monthEvents.slice(0, 5).map((event) => {
                    const Icon = EVENT_ICONS[event.type]

                    return (
                      <li key={`${event.type}-${event.id}`} className="flex items-center gap-3 py-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium first-letter:uppercase">{event.label}</p>
                          <p className="text-xs text-muted-foreground">{shortDateFormatter.format(event.date)}</p>
                        </div>
                        <Money
                          value={event.amount}
                          sign={event.type === 'expense' ? '-' : undefined}
                          className="text-sm font-semibold"
                        />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No activity recorded this month.</p>
              )}
            </CardContent>
          </Card>

          <details className="group rounded-xl border bg-card text-card-foreground shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 [&::-webkit-details-marker]:hidden">
              <span className="text-base font-semibold">Your plan</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Money value={state.incomeTotal} /> income
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="space-y-3 px-6 pb-5">
              <Meter value={allocatedShare} label="Share of income allocated" />
              <p className="text-sm text-muted-foreground">
                <Money value={state.allocationTotal} className="font-medium text-foreground" /> allocated
                {unallocated >= 0 ? (
                  <>
                    , <Money value={unallocated} className="font-medium text-foreground" /> not allocated.
                  </>
                ) : (
                  <>
                    , <Money value={-unallocated} className="font-medium text-destructive-strong" /> more than your
                    income.
                  </>
                )}
              </p>
              {state.allocationBreakdown.length > 0 ? (
                <ul className="divide-y">
                  {state.allocationBreakdown.map((allocation) => (
                    <li
                      key={`${allocation.name}-${allocation.category}-${allocation.period}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{allocation.name}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {allocation.category.replace(/_/g, ' ')} · {allocation.period}
                        </span>
                      </span>
                      <Money value={allocation.amount} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No allocations recorded yet.</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </main>
  )
}
