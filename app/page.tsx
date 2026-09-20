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
    <main className="theme-shell px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="bento-card p-6 md:p-8">
          <p className="bento-label">Personal Life Manager</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--text)] md:text-4xl">
            Finance MVP
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-[var(--muted)] md:text-base">
            Keep your income, allocations, and daily budget aligned before spending.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={userId ? '/finance' : '/finance/setup'}
              className="bento-button-primary px-4 py-2.5 text-sm font-medium"
            >
              {userId ? 'Open finance' : 'Open setup flow'}
            </Link>
            <Link
              href={userId ? '/finance' : '/login'}
              className="bento-button-secondary px-4 py-2.5 text-sm font-medium"
            >
              {userId ? 'Finance overview' : 'Go to login'}
            </Link>
          </div>
        </header>

        <section className="bento-grid md:grid-cols-2 xl:grid-cols-4">
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Income</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(financeHighlight.incomeTotal)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Monthly budget</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(financeHighlight.periodBudget)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Remaining</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(financeHighlight.monthlyRemaining)}</p>
          </div>
          <div className="bento-card p-5">
            <p className="text-sm text-[var(--muted)]">Weekly buffer</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{formatCurrency(financeHighlight.buffer)}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Finance node</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Today budget</span>
                <span className="font-semibold text-[var(--text)]">{formatCurrency(financeHighlight.dailyBudget)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Exceptions</span>
                <span className="font-semibold text-[var(--text)]">{financeHighlight.exceptionCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Objectives</span>
                <span className="font-semibold text-[var(--text)]">{goals.length}</span>
              </div>
            </div>
          </section>

          <section className="bento-card p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Project & goals</h2>
            <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Projects</span>
                <span className="font-semibold text-[var(--text)]">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span>Goals</span>
                <span className="font-semibold text-[var(--text)]">{goals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Route</span>
                <span className="font-semibold text-[var(--text)]">/finance</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
