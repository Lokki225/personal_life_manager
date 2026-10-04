import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { getHistory, historyTrend, type HistoryEvent } from '@/application/finance/getHistory'
import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { getT } from '@/lib/i18n/server'
import { m, type Translator } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'
import { describeOrigin } from '@/lib/origin'

import { categoryStyle, eventStyle } from '../categories'
import { chartPoints } from '../chart-data'
import { ColumnChart } from '../charts'
import { Money } from '../money'
import { ensureDaysSettled } from '../settle'

const CATEGORY_OPTIONS = ['all', ...new Set<string>([...EXPENSE_CATEGORIES, ...EXCEPTION_CATEGORIES])]
const TYPE_OPTIONS = ['all', 'expense', 'exception', 'movement'] as const
const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

const PERIOD_LABELS: Record<(typeof PERIOD_OPTIONS)[number], string> = {
  day: m('Today'),
  week: m('This week'),
  month: m('This month'),
  year: m('This year'),
}

const TYPE_LABELS: Record<(typeof TYPE_OPTIONS)[number], string> = {
  all: m('Everything'),
  expense: m('Expenses'),
  exception: m('Exceptions'),
  movement: m('Savings moves'),
}

// What the chart adds up. With everything listed it keeps to expenses, since
// money spent and money saved do not add up to anything.
const CHART_TITLES: Record<(typeof TYPE_OPTIONS)[number], { perDay: string; perMonth: string }> = {
  all: { perDay: m('Spending per day'), perMonth: m('Spending per month') },
  expense: { perDay: m('Spending per day'), perMonth: m('Spending per month') },
  exception: { perDay: m('Overspend per day'), perMonth: m('Overspend per month') },
  movement: { perDay: m('Money moved per day'), perMonth: m('Money moved per month') },
}

function buildHistoryHref(
  current: { period: string; type: string; category: string },
  next: Partial<typeof current>,
): string {
  const params = new URLSearchParams({
    period: next.period ?? current.period,
    type: next.type ?? current.type,
    category: next.category ?? current.category,
  })

  return `/finance/history?${params.toString()}`
}

function FilterRow({
  label,
  options,
}: {
  label: string
  options: { value: string; text: string; href: string; active: boolean }[]
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {options.map((option) => (
          <li key={option.value} className="shrink-0">
            <Link
              href={option.href}
              aria-current={option.active ? 'true' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                option.active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input text-muted-foreground hover:text-foreground',
              )}
            >
              {option.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Who recorded an entry, when it was not the person in the app.
function originLabel(origin: string | null | undefined, t: Translator) {
  const who = describeOrigin(origin)

  if (!who) {
    return null
  }

  return who.by === 'assistant' ? t('Recorded by the assistant') : t('Recorded by the key "{name}"', { name: who.name ?? '' })
}

export default async function FinanceHistoryPage({ searchParams }: PageProps<'/finance/history'>) {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  // The days that ended since the last visit are closed before anything is shown.
  await ensureDaysSettled()

  if (!userId) {
    redirect('/login')
  }

  const dayFormatter = new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeFormatter = new Intl.DateTimeFormat(t.intl, { hour: '2-digit', minute: '2-digit' })

  const params = await searchParams
  const period = String(params.period ?? 'month')
  const type = String(params.type ?? 'all')
  const category = String(params.category ?? 'all')
  const activePeriod = PERIOD_OPTIONS.includes(period as (typeof PERIOD_OPTIONS)[number])
    ? (period as (typeof PERIOD_OPTIONS)[number])
    : 'month'
  const activeType = TYPE_OPTIONS.includes(type as (typeof TYPE_OPTIONS)[number])
    ? (type as (typeof TYPE_OPTIONS)[number])
    : 'all'
  const activeCategory = CATEGORY_OPTIONS.includes(category) ? category : 'all'
  const current = { period: activePeriod, type: activeType, category: activeCategory }

  const events = await getHistory({ userId, period: activePeriod, type: activeType, category: activeCategory })

  const charted = activeType === 'all' ? events.filter((event) => event.type === 'expense') : events
  const trend = historyTrend(charted, activePeriod)
  const chartTitle = t(CHART_TITLES[activeType][activePeriod === 'year' ? 'perMonth' : 'perDay'])

  const days: { label: string; events: HistoryEvent[] }[] = []
  for (const event of events) {
    const label = dayFormatter.format(event.date)
    const day = days.at(-1)

    if (day?.label === label) {
      day.events.push(event)
    } else {
      days.push({ label, events: [event] })
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('History')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.plural(events.length, '{count} entry, newest first.', '{count} entries, newest first.')}
        </p>
      </header>

      <Card className="gap-0 py-4">
        <CardContent className="space-y-3 px-4">
          <FilterRow
            label={t('Period')}
            options={PERIOD_OPTIONS.map((value) => ({
              value,
              text: t(PERIOD_LABELS[value]),
              href: buildHistoryHref(current, { period: value }),
              active: activePeriod === value,
            }))}
          />
          <FilterRow
            label={t('Show')}
            options={TYPE_OPTIONS.map((value) => ({
              value,
              text: t(TYPE_LABELS[value]),
              href: buildHistoryHref(current, { type: value }),
              active: activeType === value,
            }))}
          />
          <FilterRow
            label={t('Category')}
            options={CATEGORY_OPTIONS.map((value) => ({
              value,
              text: value === 'all' ? t('All categories') : t(categoryStyle(value).label),
              href: buildHistoryHref(current, { category: value }),
              active: activeCategory === value,
            }))}
          />
        </CardContent>
      </Card>

      {trend && activePeriod !== 'day' && charted.length > 0 ? (
        <Card className="gap-0 py-5">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-base font-semibold">{chartTitle}</h2>
              <p className="text-sm text-muted-foreground">
                <Money
                  value={charted.reduce((sum, event) => sum + event.amount, 0)}
                  className="font-medium text-foreground"
                />{' '}
                {t('in total')}
              </p>
            </div>
            <ColumnChart points={chartPoints(activePeriod, trend.buckets, trend.totals, t.intl)} label={chartTitle} />
          </CardContent>
        </Card>
      ) : null}

      {days.length > 0 ? (
        days.map((day) => (
          <section key={day.label} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {day.label}
            </h2>
            <Card className="gap-0 py-1">
              <CardContent className="px-4">
                <ul className="divide-y">
                  {day.events.map((event) => {
                    const { icon: Icon, kind, tone, where } = eventStyle(event, t)
                    const details = [
                      event.projectName,
                      event.paidFromChest && t('From {chest}', { chest: t(event.paidFromChest) }),
                      originLabel(event.origin, t),
                      event.reason && t(event.reason),
                      event.resolution && t(event.resolution),
                    ].filter(
                      Boolean,
                    )

                    return (
                      <li key={`${event.type}-${event.id}`} className="flex items-start gap-3 py-3">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium first-letter:uppercase">{t(event.label)}</p>
                          <p className="text-xs text-muted-foreground">
                            {[kind, where, timeFormatter.format(event.date)].filter(Boolean).join(' · ')}
                          </p>
                          {details.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">{details.join(' · ')}</p>
                          ) : null}
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
              </CardContent>
            </Card>
          </section>
        ))
      ) : (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <History className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t('Nothing matches these filters')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('Try a longer period or another category.')}</p>
        </div>
      )}
    </main>
  )
}
