import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getReview } from '@/application/finance/getReview'
import { formatCurrency } from '@/domain/finance/calculations'

const PERIOD_OPTIONS = ['day', 'week', 'month', 'year'] as const

type ReviewPeriod = (typeof PERIOD_OPTIONS)[number]

export default async function FinanceReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const period = String(resolvedSearchParams.period ?? 'month')
  const selectedPeriod: ReviewPeriod = PERIOD_OPTIONS.includes(period as ReviewPeriod)
    ? (period as ReviewPeriod)
    : 'month'

  const review = await getReview({ userId, period: selectedPeriod })

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Finance review
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} review</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/finance" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Overview
              </Link>
              <Link href="/finance/history" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                History
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <label className="block text-sm font-medium text-slate-700">
              Period
              <select
                name="period"
                defaultValue={selectedPeriod}
                className="mt-1 w-40 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Apply
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Planned</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(review.plannedBudget)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Actual spent</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(review.actualSpent)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Remaining</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(review.remaining)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Exceptions</p>
            <p className="mt-2 text-2xl font-semibold">{review.exceptionCount}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Savings summary</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Actual savings</span>
                <span className="font-semibold text-slate-800">{formatCurrency(review.actualSavings)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Weekly buffer</span>
                <span className="font-semibold text-slate-800">{formatCurrency(review.buffer)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Category breakdown</h2>
            {review.categoryBreakdown.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {review.categoryBreakdown.map((entry) => (
                  <li key={entry.category} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                    <span>{entry.category}</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(entry.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No expenses in this period yet.</p>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Deviation by category</h2>
          {review.exceptionBreakdown.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {review.exceptionBreakdown.map((entry) => (
                <li key={entry.category} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                  <span>{entry.category}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(entry.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No exceptions recorded in this period.</p>
          )}
        </section>
      </div>
    </main>
  )
}
