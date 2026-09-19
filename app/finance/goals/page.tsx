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
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Finance goals
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Goals & milestones</h1>
            </div>
            <Link
              href="/finance"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to overview
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Create a goal</h2>
            <form action={createGoalAction} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Goal name
                <input
                  name="name"
                  placeholder="Emergency fund"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Target amount
                <input
                  type="number"
                  name="targetAmount"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Current amount (optional)
                <input
                  type="number"
                  name="currentAmount"
                  min="0"
                  step="0.01"
                  defaultValue={0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save goal
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Fund an existing goal</h2>
            <form action={fundGoalAction} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Goal
                <select
                  name="goalId"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  defaultValue={goals[0]?.id ?? ''}
                >
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

              <label className="block text-sm font-medium text-slate-700">
                Contribution amount
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={goals.length === 0}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Fund goal
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Goal progress</h2>

          {goals.length > 0 ? (
            <div className="mt-4 space-y-5">
              {goals.map((goal) => {
                const target = Number(goal.targetAmount || 0)
                const current = Number(goal.currentAmount || 0)
                const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0

                return (
                  <div key={goal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{goal.name}</p>
                        <p className="text-sm text-slate-600">
                          {formatCurrency(current)} / {formatCurrency(target)}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200">
                      <div
                        className="h-2.5 rounded-full bg-slate-900"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No goals created yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
