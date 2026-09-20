import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getHistory } from '@/application/finance/getHistory'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { formatCurrency } from '@/domain/finance/calculations'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

export default async function FinanceResumePage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const incomes = await financeRepository.listIncomes(userId)

  if (incomes.length === 0) {
    redirect('/finance/setup')
  }

  const [state, recentEvents] = await Promise.all([
    recomputeFinanceState({ userId }),
    getHistory({ userId, period: 'month' }),
  ])

  return (
    <main className="theme-shell px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="bento-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="bento-label">Finance overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]">
                Financial resume
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/finance/today" className="bento-button-primary px-4 py-2.5 text-sm font-medium">
                Today
              </Link>
              <Link href="/finance/history" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                History
              </Link>
              <Link href="/finance/review" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                Review
              </Link>
              <Link href="/finance/goals" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                Goals
              </Link>
              <Link href="/projects" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
                Projects
              </Link>
            </div>
          </div>
        </header>

        <section className="bento-grid md:grid-cols-2 xl:grid-cols-4">
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Income</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(state.incomeTotal)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Monthly budget</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(state.periodBudget)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Spent this month</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(state.monthlySpent)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Remaining</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(state.monthlyRemaining)}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Allocation snapshot</h2>
            <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]">{formatCurrency(state.allocationTotal)}</div>
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              {state.allocationBreakdown.length > 0 ? (
                state.allocationBreakdown.map((allocation) => (
                  <li key={`${allocation.name}-${allocation.category}`} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                    <span>
                      {allocation.name} ({allocation.category})
                    </span>
                    <span className="text-[var(--text)]">{formatCurrency(allocation.amount)}</span>
                  </li>
                ))
              ) : (
                <li>No allocations recorded yet.</li>
              )}
            </ul>
          </section>

          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Savings & buffers</h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Actual savings</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(state.actualSavings)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Weekly buffer</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(state.buffer)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Exceptions</span>
                <span className="font-semibold text-[var(--text)]">{state.exceptionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Daily budget</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(state.dailyBudget)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="bento-card p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">Recent activity</h2>
          {recentEvents.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              {recentEvents.slice(0, 5).map((event) => (
                <li key={`${event.type}-${event.id}`} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
                  <span className="text-[var(--text)]">{event.label}</span>
                  <span className="text-[var(--text)]">{formatCurrency(event.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No activity recorded yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
