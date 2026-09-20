import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { getHistory } from '@/application/finance/getHistory'
import { formatCurrency } from '@/domain/finance/calculations'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

const CATEGORY_OPTIONS = [
  'all',
  'food',
  'transportation',
  'housing',
  'emergency',
  'other',
  'savings',
  'buffer',
]

const TYPE_OPTIONS = ['all', 'expense', 'saving', 'exception'] as const
const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

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

export default async function FinanceHistoryPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const period = String(resolvedSearchParams.period ?? 'month')
  const type = String(resolvedSearchParams.type ?? 'all')
  const category = String(resolvedSearchParams.category ?? 'all')
  const activePeriod = PERIOD_OPTIONS.includes(period as (typeof PERIOD_OPTIONS)[number])
    ? (period as (typeof PERIOD_OPTIONS)[number])
    : 'month'
  const activeType = TYPE_OPTIONS.includes(type as (typeof TYPE_OPTIONS)[number])
    ? (type as (typeof TYPE_OPTIONS)[number])
    : 'all'
  const activeCategory = CATEGORY_OPTIONS.includes(category) ? category : 'all'

  const events = await getHistory({
    userId,
    period: activePeriod,
    type: activeType,
    category: activeCategory,
  })

  const groupedEvents = events.reduce<Record<string, typeof events>>((groups, event) => {
    const key = new Date(event.date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    groups[key] = groups[key] ? [...groups[key], event] : [event]
    return groups
  }, {})

  return (
    <main className="theme-shell px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-md">
          <div>
            <p className="bento-label">Finance history</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">Timeline</h1>
          </div>
          <Link href="/finance" className="bento-button-secondary px-3 py-2 text-sm font-medium">
            Overview
          </Link>
        </header>

        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((value) => (
              <Link
                key={value}
                href={buildHistoryHref({ period: activePeriod, type: activeType, category: activeCategory }, { period: value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] ${
                  activePeriod === value
                    ? 'border-[var(--border)] bg-[var(--text)] text-[var(--panel)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--muted)]'
                }`}
              >
                {value}
              </Link>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((value) => (
              <Link
                key={value}
                href={buildHistoryHref({ period: activePeriod, type: activeType, category: activeCategory }, { type: value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] ${
                  activeType === value
                    ? 'border-[var(--border)] bg-[var(--text)] text-[var(--panel)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--muted)]'
                }`}
              >
                {value === 'all' ? 'All' : value}
              </Link>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((value) => (
              <Link
                key={value}
                href={buildHistoryHref({ period: activePeriod, type: activeType, category: activeCategory }, { category: value })}
                className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] ${
                  activeCategory === value
                    ? 'border-[var(--border)] bg-[var(--text)] text-[var(--panel)]'
                    : 'border-[var(--border)] bg-transparent text-[var(--muted)]'
                }`}
              >
                {value === 'all' ? 'All categories' : value}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-md">
          <p className="text-sm text-[var(--muted)]">
            Showing {events.length} event{events.length === 1 ? '' : 's'} for {activePeriod} view.
          </p>

          {events.length > 0 ? (
            <div className="mt-4 space-y-5">
              {Object.entries(groupedEvents).map(([dateLabel, dateEvents]) => (
                <div key={dateLabel}>
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    {dateLabel}
                  </p>

                  <div className="space-y-3 border-l border-[var(--border)] pl-3">
                    {dateEvents.map((event) => {
                      const typeTone =
                        event.type === 'expense'
                          ? 'border-[rgba(239,68,68,0.4)] text-[var(--danger)]'
                          : event.type === 'saving'
                            ? 'border-[rgba(22,163,74,0.35)] text-[var(--success)]'
                            : 'border-[rgba(217,119,6,0.35)] text-[var(--warning)]'

                      return (
                        <div key={`${event.type}-${event.id}`} className="relative rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                          <div className="absolute -left-[18px] top-4 h-3 w-3 rounded-full border border-[var(--border)] bg-[var(--panel)]" />

                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${typeTone}`}>
                                  {event.type}
                                </span>
                                {event.category ? (
                                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                                    {event.category}
                                  </span>
                                ) : null}
                                {event.projectName ? (
                                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                                    {event.projectName}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-2 font-medium text-[var(--text)]">{event.label}</p>

                              {event.description ? (
                                <p className="mt-1 text-xs text-[var(--muted)]">{event.description}</p>
                              ) : null}

                              {event.reason ? (
                                <p className="mt-1 text-xs text-[var(--muted)]">Reason: {event.reason}</p>
                              ) : null}

                              {event.resolution ? (
                                <p className="mt-1 text-xs text-[var(--muted)]">Resolution: {event.resolution}</p>
                              ) : null}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="font-semibold text-[var(--text)]">{formatCurrency(event.amount)}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                                {new Date(event.date).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No events matched this filter. Try another period or category.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
