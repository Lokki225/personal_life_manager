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

  const events = await getHistory({
    userId,
    period: ['day', 'week', 'month', 'year'].includes(period) ? (period as 'day' | 'week' | 'month' | 'year') : 'month',
    type: ['all', 'expense', 'saving', 'exception'].includes(type) ? (type as 'all' | 'expense' | 'saving' | 'exception') : 'all',
    category: CATEGORY_OPTIONS.includes(category) ? category : 'all',
  })

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Finance history
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Event log</h1>
            </div>
            <Link
              href="/finance"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to overview
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form method="get" className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Period
              <select
                name="period"
                defaultValue={period}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Type
              <select
                name="type"
                defaultValue={type}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="all">All</option>
                <option value="expense">Expense</option>
                <option value="saving">Saving</option>
                <option value="exception">Exception</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Category
              <select
                name="category"
                defaultValue={category}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All categories' : option}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-3 flex gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Apply filters
              </button>
              <Link
                href="/finance/history"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Showing {events.length} event{events.length === 1 ? '' : 's'} for {period} view.
          </p>

          {events.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {events.map((event) => (
                <li key={`${event.type}-${event.id}`} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">{event.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                        {event.type}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-800">{formatCurrency(event.amount)}</span>
                  </div>

                  {event.category ? (
                    <p className="mt-2 text-sm text-slate-600">Category: {event.category}</p>
                  ) : null}

                  {event.projectName ? (
                    <p className="mt-1 text-sm text-slate-600">Project: {event.projectName}</p>
                  ) : null}

                  {event.description ? (
                    <p className="mt-1 text-sm text-slate-600">Notes: {event.description}</p>
                  ) : null}

                  {event.reason ? (
                    <p className="mt-1 text-sm text-slate-600">Reason: {event.reason}</p>
                  ) : null}

                  {event.resolution ? (
                    <p className="mt-1 text-sm text-slate-600">Resolution: {event.resolution}</p>
                  ) : null}

                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(event.date).toLocaleDateString('en-CA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              No events matched this filter. Try a different period or category.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
