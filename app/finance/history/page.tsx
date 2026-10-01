import Link from 'next/link'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { getHistory, type HistoryEvent } from '@/application/finance/getHistory'
import { EXCEPTION_CATEGORIES, EXPENSE_CATEGORIES } from '@/domain/finance/options'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { cn } from '@/lib/utils'

import { categoryStyle, eventStyle } from '../categories'
import { Money } from '../money'

const CATEGORY_OPTIONS = ['all', ...new Set<string>([...EXPENSE_CATEGORIES, ...EXCEPTION_CATEGORIES])]
const TYPE_OPTIONS = ['all', 'expense', 'exception', 'movement'] as const
const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

const PERIOD_LABELS: Record<(typeof PERIOD_OPTIONS)[number], string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

const TYPE_LABELS: Record<(typeof TYPE_OPTIONS)[number], string> = {
  all: 'Everything',
  expense: 'Expenses',
  exception: 'Exceptions',
  movement: 'Savings moves',
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

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

export default async function FinanceHistoryPage({ searchParams }: PageProps<'/finance/history'>) {
  const userId = await getSignedInUserId()

  if (!userId) {
    redirect('/login')
  }

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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {events.length} {events.length === 1 ? 'entry' : 'entries'}, newest first.
        </p>
      </header>

      <Card className="gap-0 py-4">
        <CardContent className="space-y-3 px-4">
          <FilterRow
            label="Period"
            options={PERIOD_OPTIONS.map((value) => ({
              value,
              text: PERIOD_LABELS[value],
              href: buildHistoryHref(current, { period: value }),
              active: activePeriod === value,
            }))}
          />
          <FilterRow
            label="Show"
            options={TYPE_OPTIONS.map((value) => ({
              value,
              text: TYPE_LABELS[value],
              href: buildHistoryHref(current, { type: value }),
              active: activeType === value,
            }))}
          />
          <FilterRow
            label="Category"
            options={CATEGORY_OPTIONS.map((value) => ({
              value,
              text: value === 'all' ? 'All categories' : categoryStyle(value).label,
              href: buildHistoryHref(current, { category: value }),
              active: activeCategory === value,
            }))}
          />
        </CardContent>
      </Card>

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
                    const { icon: Icon, kind, tone, where } = eventStyle(event)
                    const details = [event.projectName, event.reason, event.resolution].filter(Boolean)

                    return (
                      <li key={`${event.type}-${event.id}`} className="flex items-start gap-3 py-3">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium first-letter:uppercase">{event.label}</p>
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
          <p className="mt-3 text-sm font-medium">Nothing matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a longer period or another category.</p>
        </div>
      )}
    </main>
  )
}
