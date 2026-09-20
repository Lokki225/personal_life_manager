import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createGoalAction, fundGoalAction } from '@/app/finance/goals/actions'
import { formatCurrency } from '@/domain/finance/calculations'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

export default async function FinanceGoalsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const goals = await financeRepository.listFinancialGoals(userId)

  return (
    <main className="theme-shell px-4 py-6 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="bento-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="bento-label">Finance goals</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]">Goals & milestones</h1>
            </div>
            <Link href="/finance" className="bento-button-secondary px-4 py-2.5 text-sm font-medium">
              Back to overview
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="bento-card p-6">
            <h2 className="text-xl font-semibold text-[var(--text)]">Create a goal</h2>
            <form action={createGoalAction} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-[var(--muted)]">
                Goal name
                <input name="name" placeholder="Emergency fund" className="bento-input mt-1" required />
              </label>

              <label className="block text-sm font-medium text-[var(--muted)]">
                Target amount
                <input type="number" name="targetAmount" min="0" step="0.01" className="bento-input mt-1" required />
              </label>

              <label className="block text-sm font-medium text-[var(--muted)]">
                Current amount (optional)
                <input type="number" name="currentAmount" min="0" step="0.01" defaultValue={0} className="bento-input mt-1" />
              </label>

              <button type="submit" className="bento-button-primary px-4 py-2.5 text-sm font-medium">
                Save goal
              </button>
            </form>
          </div>

          <div className="bento-card p-6">
            <h2 className="text-xl font-semibold text-[var(--text)]">Fund an existing goal</h2>
            <form action={fundGoalAction} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-[var(--muted)]">
                Goal
                <select name="goalId" className="bento-input mt-1" defaultValue={goals[0]?.id ?? ''}>
                  {goals.length > 0 ? (
                    goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No goals yet</option>
                  )}
                </select>
              </label>

              <label className="block text-sm font-medium text-[var(--muted)]">
                Contribution amount
                <input type="number" name="amount" min="0" step="0.01" className="bento-input mt-1" required />
              </label>

              <button
                type="submit"
                disabled={goals.length === 0}
                className="bento-button-primary px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                Fund goal
              </button>
            </form>
          </div>
        </section>

        <section className="bento-card p-6">
          <h2 className="text-xl font-semibold text-[var(--text)]">Goal progress</h2>

          {goals.length > 0 ? (
            <div className="mt-4 space-y-5">
              {goals.map((goal) => {
                const target = Number(goal.targetAmount || 0)
                const current = Number(goal.currentAmount || 0)
                const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0

                return (
                  <div key={goal.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--text)]">{goal.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {formatCurrency(current)} / {formatCurrency(target)}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-[var(--text)]">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="mt-3 h-2.5 w-full rounded-full bg-[var(--panel-muted)]">
                      <div className="h-2.5 rounded-full bg-[var(--text)]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">No goals created yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
