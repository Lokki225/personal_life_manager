'use client'

import { useState } from 'react'

import { summarizeSetupPlan } from '@/application/finance/setupFinancePlan'
import { formatCurrency } from '@/domain/finance/calculations'

import { saveSetupPlan } from './actions'

type AllocationDraft = {
  id: number
  name: string
  amount: string
  period: 'monthly' | 'weekly'
  category: string
}

const createAllocation = (): AllocationDraft => ({
  id: Date.now() + Math.random(),
  name: 'Daily Living',
  amount: '3000',
  period: 'monthly',
  category: 'daily_living',
})

export default function FinanceSetupPage() {
  const [incomeSource, setIncomeSource] = useState('Salary')
  const [incomeAmount, setIncomeAmount] = useState(5000)
  const [incomeFrequency, setIncomeFrequency] = useState('monthly')
  const [allocations, setAllocations] = useState<AllocationDraft[]>([createAllocation()])

  const totalAllocationAmount = allocations.reduce(
    (total, allocation) => total + Number(allocation.amount || 0),
    0,
  )
  const firstAllocationPeriod = allocations[0]?.period ?? 'monthly'
  const summary = summarizeSetupPlan({
    incomeAmount,
    allocationAmount: totalAllocationAmount,
    allocationPeriod: firstAllocationPeriod,
  })

  const updateAllocation = (id: number, field: keyof AllocationDraft, value: string) => {
    setAllocations((currentAllocations) =>
      currentAllocations.map((allocation) =>
        allocation.id === id
          ? {
              ...allocation,
              [field]: field === 'amount' ? value : value,
            }
          : allocation,
      ),
    )
  }

  const addAllocation = () => {
    setAllocations((currentAllocations) => [...currentAllocations, createAllocation()])
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Finance setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Plan your monthly budget</h1>
          <p className="mt-2 text-slate-600">
            Capture your income and the recurring allocations that shape your daily budget.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form action={saveSetupPlan} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">1. Income</h2>
              <label className="block text-sm font-medium text-slate-700">
                Source
                <input
                  name="incomeSource"
                  value={incomeSource}
                  onChange={(event) => setIncomeSource(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-slate-500"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Amount
                  <input
                    type="number"
                    name="incomeAmount"
                    value={incomeAmount}
                    onChange={(event) => setIncomeAmount(Number(event.target.value || 0))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-slate-500"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Frequency
                  <select
                    name="incomeFrequency"
                    value={incomeFrequency}
                    onChange={(event) => setIncomeFrequency(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-slate-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="occasional">Occasional</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">2. Allocations</h2>
                <button
                  type="button"
                  onClick={addAllocation}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Add allocation
                </button>
              </div>

              {allocations.map((allocation, index) => (
                <div key={allocation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Allocation {index + 1}</p>
                    {allocations.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAllocations((currentAllocations) =>
                            currentAllocations.filter((entry) => entry.id !== allocation.id),
                          )
                        }
                        className="text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      Name
                      <input
                        name="allocationName"
                        value={allocation.name}
                        onChange={(event) =>
                          updateAllocation(allocation.id, 'name', event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Amount
                      <input
                        type="number"
                        name="allocationAmount"
                        value={allocation.amount}
                        onChange={(event) =>
                          updateAllocation(allocation.id, 'amount', event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Period
                      <select
                        name="allocationPeriod"
                        value={allocation.period}
                        onChange={(event) =>
                          updateAllocation(
                            allocation.id,
                            'period',
                            event.target.value as 'monthly' | 'weekly',
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Category
                    <select
                      name="allocationCategory"
                      value={allocation.category}
                      onChange={(event) =>
                        updateAllocation(allocation.id, 'category', event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="subscription">Subscription</option>
                      <option value="daily_living">Daily living</option>
                      <option value="savings">Savings</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Save setup
            </button>
          </form>

          <aside className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Derived daily budget</p>
            <div className="mt-4 text-4xl font-semibold">{formatCurrency(summary.dailyBudget)}</div>
            <dl className="mt-6 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <dt>Income</dt>
                <dd>{formatCurrency(summary.incomeAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Allocations</dt>
                <dd>{formatCurrency(summary.allocationAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Period</dt>
                <dd>{summary.allocationPeriod}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  )
}
