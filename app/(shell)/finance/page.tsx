import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, ChevronDown, ChevronRight, Lock, Target, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { depositSetupMonth, listPendingIncomes, listSetupMonthIncomes } from '@/application/finance/confirmIncome'
import { hasSetupPlan } from '@/application/finance/createSetupPlan'
import { getHistory } from '@/application/finance/getHistory'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { expectedSpendToDate, getDailyFinanceStatus } from '@/domain/finance/calculations'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { greetingFor, shortName } from '@/lib/greeting'
import { now as clockNow, setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'

import { LogoTile } from '../../logo'
import { categoryStyle, eventStyle } from './categories'
import { CoverFromBufferButton, EditExpenseDrawer } from './expense-forms'
import { Meter, Money } from './money'
import { AddAllocationDrawer, AddIncomeDrawer, EditAllocationDrawer, EditIncomeDrawer } from './plan-forms'
import { AddExpenseDrawer, ConfirmIncomeDrawer, ExceptionDrawer, SaveRemainingDrawer } from './today-actions'
import { ensureDaysSettled } from './settle'

const STATUS_STYLES = {
  emerald: { dot: 'bg-success', meter: 'success' },
  amber: { dot: 'bg-warning', meter: 'warning' },
  rose: { dot: 'bg-destructive', meter: 'danger' },
} as const

// How the day stands, in words.
const STATUS_LABELS = { Safe: m('Safe'), Caution: m('Caution'), Overspent: m('Overspent') } as const

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
  const [user, t] = await Promise.all([getSignedInUser(), getT()])

  if (!user) {
    redirect('/login')
  }

  const userId = user.id
  // Days are counted on this person's clock from here on.
  setClockZone(user.timeZone)

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  const now = clockNow()
  // Loaded together with the setup check: one trip to the database, not two.
  const [isSetUp, state, monthEvents, pendingIncomes, setupMonthIncomes] = await Promise.all([
    hasSetupPlan(userId),
    recomputeFinanceState({ userId, referenceDate: now }),
    getHistory({ userId, period: 'month', referenceDate: now }),
    listPendingIncomes(userId, now),
    listSetupMonthIncomes(userId, now),
  ])

  if (!isSetUp) {
    redirect('/finance/setup')
  }

  // A plan made before the setup month's income was placed in the chests:
  // place it once, then show the page with it.
  if (setupMonthIncomes.length > 0 && (await depositSetupMonth(userId, now)) > 0) {
    redirect('/finance')
  }

  const dayFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long' })
  const shortDateFormatter = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short' })
  const today = dayFormatter.format(now)

  const greeting = greetingFor(now, t)
  const displayName = shortName(user)

  const hasDailyBudget = state.dailyBudget > 0
  const isOver = state.dailyOverspend > 0
  const spendingStatus = getDailyFinanceStatus(state.dailyBudget, state.dailySpent)
  // Saving first and spending later can put the day over even when spending
  // alone is within budget.
  const status = isOver ? { label: 'Overspent' as const, tone: 'rose' as const } : spendingStatus
  const statusStyle = STATUS_STYLES[status.tone]
  const availableToSave = Math.floor(state.dailySaving)
  // What the Buffer can pay of today's overspend.
  const coverable = state.uncoveredDay ? 0 : Math.min(Math.floor(state.dailyOverspend), Math.floor(state.buffer))

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
      <header className="space-y-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5">
          <LogoTile className="size-8" />
          <span className="text-sm font-semibold tracking-tight">Personal Life Manager</span>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {displayName
              ? t('{salutation}, {name}!', { salutation: greeting.salutation, name: displayName })
              : t('{salutation}!', { salutation: greeting.salutation })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {today.charAt(0).toUpperCase() + today.slice(1)} · {greeting.note}
          </p>
        </div>
      </header>

      {state.expenseTotal === 0 ? (
        <Link
          href="/learn"
          className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm"
        >
          <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1">
            <span className="font-medium">{t('New here?')}</span>{' '}
            <span className="text-muted-foreground">{t('Read how the app works, in five minutes.')}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {pendingIncomes.map((income) => (
            <div
              key={income.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('Has {source} arrived?', { source: income.source })}</p>
                <p className="text-xs text-muted-foreground">{t('Confirm it to fill your chests.')}</p>
              </div>
              <ConfirmIncomeDrawer
                income={{ id: income.id, source: income.source, usualAmount: income.usualAmount }}
              />
            </div>
          ))}

          <Card className="gap-0 py-5">
            <CardContent className="space-y-5">
              {hasDailyBudget ? (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {isOver ? t('Over today') : t('Left today')}
                      </p>
                      <Badge variant="outline" className="gap-1.5">
                        <span className={cn('size-2 rounded-full', statusStyle.dot)} aria-hidden="true" />
                        {t(STATUS_LABELS[status.label])}
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
                      label={t("Share of today's budget used")}
                    />
                    <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                      <span>
                        {t('Spent')} <Money value={state.dailySpent} className="font-medium text-foreground" />
                      </span>
                      <span>
                        {t('Budget')} <Money value={state.dailyBudget} className="font-medium text-foreground" />
                      </span>
                    </p>
                    {state.savedToday > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        <Money value={state.savedToday} className="font-medium text-foreground" />{' '}
                        {t("saved from today's budget.")}
                      </p>
                    ) : null}
                    {state.uncoveredDay ? (
                      <p className="text-sm text-muted-foreground">
                        {t("Your plan covers 30 days, so today's budget comes from your Buffer and Base Chest.")}
                      </p>
                    ) : null}
                    {state.coveredToday > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('The budget includes')}{' '}
                        <Money value={state.coveredToday} className="font-medium text-foreground" />{' '}
                        {t('taken from your Buffer.')}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : state.uncoveredDay ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('No budget today')}</p>
                  <p className="mt-2 text-sm">
                    {t(
                      'Your plan covers 30 days, and your Buffer and Base Chest have nothing to cover the 31st. Expenses are still recorded.',
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('No daily budget yet')}</p>
                  <p className="mt-2 text-sm">
                    {t(
                      'Your plan has no "Daily living" allocation, so there is nothing to spread over the month. Expenses are still recorded.',
                    )}
                  </p>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 sm:[&>*:only-child]:col-span-2">
                <AddExpenseDrawer
                  left={Math.floor(state.dailyRemaining)}
                  hasBudget={hasDailyBudget}
                  chests={state.chests
                    .filter(
                      (chest) =>
                        chest.balance >= 1 && !(chest.type === 'SECURE' && chest.lockedUntil && chest.lockedUntil > now),
                    )
                    .map((chest) => ({ id: chest.id, name: chest.name, balance: Math.floor(chest.balance) }))}
                />
                {isOver && !state.overspendExplained ? <ExceptionDrawer overspend={state.dailyOverspend} /> : null}
                {!isOver && availableToSave >= 1 ? (
                  <SaveRemainingDrawer
                    available={availableToSave}
                    chests={state.chests.map((chest) => ({ id: chest.id, name: chest.name }))}
                  />
                ) : null}
              </div>
              {coverable >= 1 ? <CoverFromBufferButton amount={coverable} /> : null}
              {isOver && state.overspendExplained ? (
                <p className="text-sm text-muted-foreground">
                  {t("Today's overspend is explained. See it in Review.")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title={t('Spent today')} />
              {state.dailyExpenses.length > 0 ? (
                <>
                  {categoryTotals.length > 1 ? (
                    <ul className="flex flex-wrap gap-2">
                      {categoryTotals.map(([category, total]) => (
                        <li key={category}>
                          <Badge variant="secondary" className="gap-1.5 py-1">
                            {t(categoryStyle(category).label)}
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
                        <li key={expense.id} className="animate-message-in flex items-center gap-3 py-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{expense.description || t(label)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[
                                t(label),
                                expense.projectName,
                                expense.paidFromChest ? t('From {chest}', { chest: t(expense.paidFromChest) }) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <Money value={expense.amount} sign="-" className="shrink-0 text-sm font-semibold" />
                          {state.uncoveredDay && !expense.paidFromChest ? null : (
                            <EditExpenseDrawer
                              expense={{
                                id: expense.id,
                                amount: expense.amount,
                                category: expense.category,
                                description: expense.description ?? null,
                              }}
                              label={expense.description || t(label)}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('Nothing spent yet today.')}
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
                {t.plural(
                  state.exceptionCount,
                  '{count} exception this month. Review what went off plan.',
                  '{count} exceptions this month. Review what went off plan.',
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : null}

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title={t('This month')} href="/finance/review" linkLabel={t('Review')} />
              {state.periodBudget > 0 ? (
                <>
                  <p className={cn('text-2xl font-semibold tracking-tight', monthOver && 'text-destructive-strong')}>
                    <Money value={Math.abs(state.monthlyRemaining)} />
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {monthOver ? t('over budget') : t('left')}
                    </span>
                  </p>
                  <Meter
                    value={(state.monthlySpent / state.periodBudget) * 100}
                    tone={monthOver ? 'danger' : paceGap < 0 ? 'warning' : 'success'}
                    marker={(expectedByToday / state.periodBudget) * 100}
                    label={t("Share of the month's budget spent")}
                  />
                  <p className="flex flex-wrap justify-between gap-x-4 text-sm text-muted-foreground">
                    <span>
                      {t('Spent')} <Money value={state.monthlySpent} className="font-medium text-foreground" />
                    </span>
                    <span>
                      {t('of')} <Money value={state.periodBudget} className="font-medium text-foreground" />
                    </span>
                  </p>
                  <p className="text-sm">
                    <Money value={Math.abs(paceGap)} className="font-semibold" />{' '}
                    {paceGap >= 0 ? t("under the pace for today's date.") : t("over the pace for today's date.")}{' '}
                    <span className="text-muted-foreground">{t('The line marks where even spending would be.')}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Money value={state.monthlySpent} className="font-medium text-foreground" />{' '}
                  {t('spent this month.')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardContent className="space-y-3">
              <SectionHeading title={t('Savings')} href="/finance/chests" linkLabel={t('Manage')} />
              <dl className="grid gap-3 min-[400px]:grid-cols-2">
                <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 min-[400px]:block">
                  <dt className="text-xs text-muted-foreground">{t('In your chests')}</dt>
                  <dd className="text-lg font-semibold min-[400px]:mt-0.5">
                    <Money value={state.totalSaved} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 min-[400px]:block">
                  <dt className="text-xs text-muted-foreground">{t('Of which buffer')}</dt>
                  <dd className="text-lg font-semibold min-[400px]:mt-0.5">
                    <Money value={state.buffer} />
                  </dd>
                </div>
              </dl>
              {state.chests.length > 0 ? (
                <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  {state.chests.map((chest) => (
                    <li key={chest.id} className="min-w-32 shrink-0 rounded-lg border px-3 py-2.5 sm:flex-1">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {chest.type === 'SECURE' ? <Lock className="size-3" aria-label={t('Secure chest')} /> : null}
                        <span className="truncate">{t(chest.name)}</span>
                      </p>
                      <p className={cn('mt-1 text-sm font-semibold', chest.balance < 0 && 'text-destructive-strong')}>
                        <Money value={chest.balance} />
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('Your chests are created the first time you save what is left of a day.')}
                </p>
              )}
            </CardContent>
          </Card>

          {state.goals.length > 0 ? (
            <Card className="gap-0 py-5">
              <CardContent className="space-y-3">
                <SectionHeading title={t('Goals')} href="/finance/goals" linkLabel={t('All goals')} />
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
                            {goal.satisfied ? t('Reached') : t('In progress')}
                          </span>
                        </div>
                        {balance ? (
                          <>
                            <Meter
                              value={(balance.actual / balance.target) * 100}
                              tone={goal.satisfied ? 'success' : 'primary'}
                              label={t('Progress towards {goal}', { goal: goal.name })}
                            />
                            <p className="text-xs text-muted-foreground">
                              <Money value={balance.actual} className="font-medium text-foreground" /> {t('of')}{' '}
                              <Money value={balance.target} />
                            </p>
                          </>
                        ) : null}
                        {goal.borrowed > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t('Of which')} <Money value={goal.borrowed} /> {t('borrowed')}
                            {goal.owed > 0 ? (
                              <>
                                , <Money value={goal.owed} className="font-medium text-foreground" />{' '}
                                {t('still owed')}
                              </>
                            ) : (
                              `, ${t('fully repaid')}`
                            )}
                            .
                          </p>
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
              <SectionHeading title={t('Recent activity')} href="/finance/history" linkLabel={t('History')} />
              {monthEvents.length > 0 ? (
                <ul className="divide-y">
                  {monthEvents.slice(0, 5).map((event) => {
                    const { icon: Icon, tone, where } = eventStyle(event, t)

                    return (
                      <li key={`${event.type}-${event.id}`} className="flex items-center gap-3 py-2.5">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium first-letter:uppercase">{t(event.label)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[where, shortDateFormatter.format(event.date)].filter(Boolean).join(' · ')}
                          </p>
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
                <p className="text-sm text-muted-foreground">{t('No activity recorded this month.')}</p>
              )}
            </CardContent>
          </Card>

          <details className="group rounded-xl border bg-card text-card-foreground shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 [&::-webkit-details-marker]:hidden">
              <span className="text-base font-semibold">{t('Your plan')}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Money value={state.incomeTotal} /> {t('income')}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="space-y-3 px-6 pb-5">
              <Meter value={allocatedShare} label={t('Share of income allocated')} />
              <p className="text-sm text-muted-foreground">
                <Money value={state.allocationTotal} className="font-medium text-foreground" /> {t('allocated')}
                {unallocated >= 0 ? (
                  <>
                    , <Money value={unallocated} className="font-medium text-foreground" /> {t('not allocated.')}
                  </>
                ) : (
                  <>
                    , <Money value={-unallocated} className="font-medium text-destructive-strong" />{' '}
                    {t('more than your income.')}
                  </>
                )}
              </p>
              <ul className="divide-y border-b">
                {state.incomes.map((income) => (
                  <li key={income.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        <span className="line-clamp-2">{income.source}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('Income, expected on the {day} of each month', { day: String(income.payDay) })}
                      </span>
                    </span>
                    <Money value={income.amount} className="shrink-0 font-semibold" />
                    <EditIncomeDrawer income={income} canDelete={state.incomes.length > 1} />
                  </li>
                ))}
              </ul>
              {state.allocationBreakdown.length > 0 ? (
                <ul className="divide-y">
                  {state.allocationBreakdown.map((allocation) => (
                    <li key={allocation.id} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          <span className="line-clamp-2">{allocation.name}</span>
                        </span>
                        <span className="inline-block text-xs text-muted-foreground first-letter:uppercase">
                          {t(allocation.category.replace(/_/g, ' '))} · {t(allocation.period)}
                        </span>
                      </span>
                      <Money value={allocation.amount} className="shrink-0 font-semibold" />
                      <EditAllocationDrawer allocation={allocation} />
                    </li>
                  ))}
                  {unallocated > 0 ? (
                    <li className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{t('Not allocated')}</span>
                        <span className="text-xs text-muted-foreground">
                          {t('It is kept in your Base Chest.')}
                        </span>
                      </span>
                      <Money value={unallocated} className="shrink-0 font-semibold" />
                      {/* Lines up with the rows that have an edit button. */}
                      <span className="-mr-2 size-11 shrink-0" aria-hidden="true" />
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('No allocations recorded yet.')}</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <AddAllocationDrawer />
                <AddIncomeDrawer />
              </div>
            </div>
          </details>
        </div>
      </div>
    </main>
  )
}
