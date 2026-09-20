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
    <main className="theme-shell px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="bento-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="bento-label">Finance review</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]">
                {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} review
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/finance" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                Overview
              </Link>
              <Link href="/finance/history" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                History
              </Link>
            </div>
          </div>
        </header>

        <section className="bento-card p-6">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <label className="block text-sm font-medium text-[var(--muted)]">
              Period
              <select name="period" defaultValue={selectedPeriod} className="bento-input mt-1 w-40">
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="bento-button-primary px-4 py-2.5 text-sm font-medium">
              Apply
            </button>
          </form>
        </section>

        <section className="bento-grid md:grid-cols-2 xl:grid-cols-4">
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Planned</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(review.plannedBudget)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Actual spent</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(review.actualSpent)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Remaining</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(review.remaining)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Exceptions</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{review.exceptionCount}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Savings summary</h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Actual savings</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(review.actualSavings)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Weekly buffer</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(review.buffer)}</span>
              </div>
            </div>
          </section>

          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Category breakdown</h2>
            {review.categoryBreakdown.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                {review.categoryBreakdown.map((entry) => (
                  <li key={entry.category} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                    <span>{entry.category}</span>
                    <span className="font-semibold text-[var(--text)]">{formatCurrency(entry.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">No expenses in this period yet.</p>
            )}
          </section>
        </div>

        <section className="bento-card p-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Deviation by category</h2>
          {review.exceptionBreakdown.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              {review.exceptionBreakdown.map((entry) => (
                <li key={entry.category} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                  <span>{entry.category}</span>
                  <span className="font-semibold text-[var(--text)]">{formatCurrency(entry.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No exceptions recorded in this period.</p>
          )}
        </section>
      </div>
    </main>
  )
}
