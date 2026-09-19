import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { formatCurrency } from '@/domain/finance/calculations'

import { addExpense, recordException, saveUnderspend } from './actions'

export default async function FinanceTodayPage() {
  const session = await getServerSession(authOptions)
  const userId =
    session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const state = await recomputeFinanceState({ userId })
  const hasAvailableSaving = state.dailySaving > 0
  const hasOverspend = state.dailyOverspend > 0

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Finance today
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Daily and monthly budget overview</h1>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Daily view
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Daily budget</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.dailyBudget)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Spent today</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.dailySpent)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Remaining today</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.dailyRemaining)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Overspend</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.dailyOverspend)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Monthly view
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Allocated for month</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.periodBudget)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Spent this month</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.monthlySpent)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Remaining month</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.monthlyRemaining)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Monthly overspend</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(state.monthlyOverspend)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Income distribution</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Daily living bucket: {formatCurrency(state.dailyLivingAllocation)}
            </span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Today’s expenses</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {state.dailyExpenses.length} item{state.dailyExpenses.length === 1 ? '' : 's'}
            </span>
          </div>

          {state.dailyExpenses.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {state.dailyExpenses.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium text-slate-800">{expense.description || expense.category}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{expense.category}</p>
                  </div>
                  <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No expenses recorded today yet.</p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Add expense</h2>
            <form action={addExpense} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Amount
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Category
                <select
                  name="category"
                  defaultValue="food"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="food">Food</option>
                  <option value="transportation">Transportation</option>
                  <option value="housing">Housing</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Description
                <input
                  name="description"
                  placeholder="Groceries, taxi, rent..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Record expense
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Daily action</h2>

            {hasOverspend ? (
              <form action={recordException} className="mt-4 space-y-4">
                <p className="text-sm text-rose-700">
                  You are over the daily budget by {formatCurrency(state.dailyOverspend)}.
                </p>

                <input type="hidden" name="plannedAmount" value={state.dailyBudget} />
                <input type="hidden" name="actualAmount" value={state.dailySpent} />

                <label className="block text-sm font-medium text-slate-700">
                  Category
                  <select
                    name="category"
                    defaultValue="emergency"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    <option value="transportation">Transportation</option>
                    <option value="food">Food</option>
                    <option value="emergency">Emergency</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Reason
                  <input
                    name="reason"
                    placeholder="Why did this go over?"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Resolution
                  <input
                    name="resolution"
                    placeholder="How will it be handled?"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                >
                  Record exception
                </button>
              </form>
            ) : hasAvailableSaving ? (
              <form action={saveUnderspend} className="mt-4 space-y-4">
                <p className="text-sm text-emerald-700">
                  You can save {formatCurrency(state.dailySaving)} from the remaining budget.
                </p>
                <input type="hidden" name="amount" value={state.dailySaving} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Save {formatCurrency(state.dailySaving)}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                No immediate action needed. Your daily budget is currently on track.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
