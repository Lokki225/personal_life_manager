import Link from 'next/link'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { formatCurrency } from '@/domain/finance/calculations'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

export default async function Home() {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  const [state, goals, projects] = userId
    ? await Promise.all([
        recomputeFinanceState({ userId }),
        financeRepository.listFinancialGoals(userId),
        financeRepository.listProjects(userId),
      ])
    : [null, [], []] as const

  const financeHighlight = state ?? {
    incomeTotal: 0,
    periodBudget: 0,
    monthlyRemaining: 0,
    dailyBudget: 0,
    buffer: 0,
    exceptionCount: 0,
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Personal Life Manager
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Finance MVP</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Keep your income, allocations, and daily budget aligned before spending.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={userId ? '/finance' : '/finance/setup'}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              {userId ? 'Open finance' : 'Open setup flow'}
            </Link>
            <Link
              href={userId ? '/finance' : '/login'}
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {userId ? 'Finance overview' : 'Go to login'}
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Income</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(financeHighlight.incomeTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Monthly budget</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(financeHighlight.periodBudget)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Remaining</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(financeHighlight.monthlyRemaining)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Weekly buffer</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(financeHighlight.buffer)}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Finance node</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Today budget</span>
                <span className="font-semibold text-slate-800">{formatCurrency(financeHighlight.dailyBudget)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Exceptions</span>
                <span className="font-semibold text-slate-800">{financeHighlight.exceptionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Objectives</span>
                <span className="font-semibold text-slate-800">{goals.length}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Project & goals</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Projects</span>
                <span className="font-semibold text-slate-800">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Goals</span>
                <span className="font-semibold text-slate-800">{goals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Route</span>
                <span className="font-semibold text-slate-800">/finance</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
