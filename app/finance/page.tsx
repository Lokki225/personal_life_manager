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
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Finance overview
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Financial resume</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/finance/today"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Today
              </Link>
              <Link
                href="/finance/history"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                History
              </Link>
              <Link
                href="/finance/review"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Review
              </Link>
              <Link
                href="/finance/goals"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Goals
              </Link>
              <Link
                href="/projects"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Projects
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Income</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.incomeTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Monthly budget</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.periodBudget)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Spent this month</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.monthlySpent)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Remaining</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.monthlyRemaining)}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Allocation snapshot</h2>
            <div className="mt-4 text-3xl font-semibold">{formatCurrency(state.allocationTotal)}</div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {state.allocationBreakdown.length > 0 ? (
                state.allocationBreakdown.map((allocation) => (
                  <li key={`${allocation.name}-${allocation.category}`} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                    <span>
                      {allocation.name} ({allocation.category})
                    </span>
                    <span>{formatCurrency(allocation.amount)}</span>
                  </li>
                ))
              ) : (
                <li>No allocations recorded yet.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Savings & buffers</h2>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Actual savings</span>
                <span className="font-semibold text-slate-800">{formatCurrency(state.actualSavings)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Weekly buffer</span>
                <span className="font-semibold text-slate-800">{formatCurrency(state.buffer)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Exceptions</span>
                <span className="font-semibold text-slate-800">{state.exceptionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Daily budget</span>
                <span className="font-semibold text-slate-800">{formatCurrency(state.dailyBudget)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Recent activity</h2>
          {recentEvents.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {recentEvents.slice(0, 5).map((event) => (
                <li key={`${event.type}-${event.id}`} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                  <span>
                    {event.label}
                  </span>
                  <span>{formatCurrency(event.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No activity recorded yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
