import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { formatCurrency, getDailyFinanceStatus } from '@/domain/finance/calculations'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

import { ExpenseQuickAdd } from './expense-quick-add'
import { recordException, saveUnderspend, transferBufferToSavings } from './actions'

export default async function FinanceTodayPage() {
  const session = await getServerSession(authOptions)
  const userId =
    session?.user && 'id' in session.user ? String(session.user.id) : null

  if (!userId) {
    redirect('/login')
  }

  const [state, projects] = await Promise.all([
    recomputeFinanceState({ userId }),
    financeRepository.listProjects(userId),
  ])
  const hasAvailableSaving = state.dailySaving > 0
  const hasOverspend = state.dailyOverspend > 0
  const hasBufferToTransfer = state.buffer > 0
  const todayStatus = getDailyFinanceStatus(state.dailyBudget, state.dailySpent)

  const toneClasses = {
    emerald: 'border-[color:rgba(22,163,74,0.35)] bg-[rgba(22,163,74,0.08)] text-[var(--success)]',
    amber: 'border-[color:rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.08)] text-[var(--warning)]',
    rose: 'border-[color:rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] text-[var(--danger)]',
  } as const

  return (
    <main className="theme-shell px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex gap-2">
          <Link
            href="/finance/today"
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm font-medium text-[var(--text)] shadow-[var(--shadow-soft)]"
          >
            Today
          </Link>
          <Link
            href="/finance"
            className="rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--muted)]"
          >
            Month
          </Link>
        </div>

        <div className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${toneClasses[todayStatus.tone]}`}>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-current/25 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
              {todayStatus.label}
            </span>
            <p className="text-sm text-current">{todayStatus.message}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
          <div className="bento-card p-5">
            <p className="text-[15px] text-[var(--muted)]">Remaining today</p>
            <div className="mt-3 text-[52px] font-semibold leading-none tracking-[-0.07em] text-[var(--text)]">
              {formatCurrency(state.dailyRemaining).replace('XOF ', '').replace('.00', '')}
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              of a {formatCurrency(state.dailyBudget)} daily budget
            </p>
          </div>

          <div className="grid gap-4">
            <div className="bento-card p-5">
              <p className="text-[15px] text-[var(--muted)]">Daily budget</p>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--text)]">
                {formatCurrency(state.dailyBudget).replace('XOF ', '').replace('.00', '')}
              </div>
            </div>

            <div className="bento-card p-5">
              <p className="text-[15px] text-[var(--muted)]">Spent today</p>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--text)]">
                {formatCurrency(state.dailySpent).replace('XOF ', '').replace('.00', '')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="bento-card p-5">
            <p className="text-[15px] text-[var(--muted)]">Buffer this month</p>
            <div className="mt-4 text-[42px] font-semibold tracking-[-0.06em] text-[var(--success)]">
              {formatCurrency(state.buffer).replace('XOF ', '').replace('.00', '')}
            </div>
          </div>

          <div className="bento-card p-5">
            <p className="text-[15px] text-[var(--muted)]">Actual savings</p>
            <div className="mt-4 text-[42px] font-semibold tracking-[-0.06em] text-[var(--text)]">
              {formatCurrency(state.actualSavings).replace('XOF ', '').replace('.00', '')}
            </div>
          </div>
        </div>

        {hasBufferToTransfer ? (
          <form action={transferBufferToSavings} className="mt-4 rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <input type="hidden" name="amount" value={state.buffer} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Transfer</p>
                <h2 className="mt-1 text-base font-semibold text-white">Move buffer to savings</h2>
              </div>
              <span className="text-sm font-medium text-[#4ade80]">{formatCurrency(state.buffer)}</span>
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl border border-[#3a3e42] bg-[#1b1f22] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
            >
              Transfer to savings
            </button>
          </form>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {hasAvailableSaving ? (
            <form action={saveUnderspend} className="rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <input type="hidden" name="amount" value={state.dailySaving} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Quick action</p>
                  <h2 className="mt-1 text-base font-semibold text-white">Save remaining</h2>
                </div>
                <span className="text-sm font-medium text-[#4ade80]">{formatCurrency(state.dailySaving)}</span>
              </div>
              <button
                type="submit"
                className="mt-4 w-full rounded-xl border border-[#3a3e42] bg-[#1b1f22] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
              >
                Save to buffer
              </button>
            </form>
          ) : null}

          {hasOverspend ? (
            <form action={recordException} className="rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <input type="hidden" name="plannedAmount" value={state.dailyBudget} />
              <input type="hidden" name="actualAmount" value={state.dailySpent} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Quick action</p>
                  <h2 className="mt-1 text-base font-semibold text-white">Record exception</h2>
                </div>
                <span className="text-sm font-medium text-[#fda4af]">{formatCurrency(state.dailyOverspend)}</span>
              </div>

              <div className="mt-3 space-y-2">
                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block">Category</span>
                  <select
                    name="category"
                    defaultValue="other"
                    className="w-full rounded-lg border border-[#3a3e42] bg-[#201f20] px-2.5 py-2 text-sm text-white outline-none focus:border-slate-500"
                  >
                    <option value="food">Food</option>
                    <option value="transportation">Transportation</option>
                    <option value="housing">Housing</option>
                    <option value="emergency">Emergency</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block">Why did it happen?</span>
                  <input
                    type="text"
                    name="reason"
                    placeholder="Unexpected expense"
                    className="w-full rounded-lg border border-[#3a3e42] bg-[#201f20] px-2.5 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                  />
                </label>

                <label className="block text-xs text-slate-300">
                  <span className="mb-1 block">Resolution (optional)</span>
                  <input
                    type="text"
                    name="resolution"
                    placeholder="Cut back next week"
                    className="w-full rounded-lg border border-[#3a3e42] bg-[#201f20] px-2.5 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 w-full rounded-xl border border-[#3a3e42] bg-[#1b1f22] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
              >
                Save exception
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1.2fr]">
          <section className="rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <h2 className="text-[15px] font-semibold text-white">Add an expense</h2>
            <div className="mt-5">
              <ExpenseQuickAdd projects={projects} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <h2 className="text-[15px] font-semibold text-white">Spending by category — today</h2>
            {state.dailyExpenses.length > 0 ? (
              <div className="mt-4 space-y-3">
                {state.dailyExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between border-b border-[#2a2d30] pb-3 text-sm text-slate-300 last:border-b-0 last:pb-0">
                    <div>
                      <p className="font-medium text-white">{expense.category}</p>
                      {expense.description ? <p className="text-xs text-slate-400">{expense.description}</p> : null}
                    </div>
                    <span className="font-medium text-slate-100">{formatCurrency(expense.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-base text-slate-400">No expenses to show yet.</p>
            )}
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-[#2a2d30] bg-[#171a1d] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white">Today&apos;s activity</h2>
            <span className="rounded-full border border-[#2f3438] bg-[#111315] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
              {state.dailyExpenses.length} {state.dailyExpenses.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {state.dailyExpenses.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-300">
              {state.dailyExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#2a2d30] bg-[#111315] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#2f3438] bg-[#171b1e] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-300">
                        {expense.category}
                      </span>
                      {expense.projectName ? (
                        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
                          {expense.projectName}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate font-medium text-white">
                      {expense.description || 'Expense'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-medium text-slate-100">{formatCurrency(expense.amount)}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      {new Date(expense.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No expenses recorded yet today.</p>
          )}
        </section>
      </div>
    </main>
  )
}
