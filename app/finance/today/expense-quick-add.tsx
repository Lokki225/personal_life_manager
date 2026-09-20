'use client'

import { useState } from 'react'

import { validateExpenseInput } from '@/domain/finance/expenseValidation'

import { addExpense } from './actions'

type Project = {
  id: string
  name: string
}

export function ExpenseQuickAdd({ projects }: { projects: Project[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const amount = Number(formData.get('amount'))
    const category = String(formData.get('category') ?? '')
    const errorMessage = validateExpenseInput(amount, category)

    if (errorMessage) {
      setValidationMessage(errorMessage)
      return
    }

    setValidationMessage(null)
    setIsSubmitting(true)

    try {
      await addExpense(formData)
      event.currentTarget.reset()
      setIsOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center rounded-xl border border-[#3a3e42] bg-transparent px-3 py-3 text-[18px] font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
      >
        Add expense
      </button>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#2f3438] bg-[#f8fafc] text-2xl font-semibold text-[#111315] shadow-[0_16px_36px_rgba(15,23,42,0.35)] transition hover:scale-[1.02] sm:right-6"
        aria-label="Add expense"
      >
        +
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl border border-[#2a2d30] bg-[#171a1d] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Quick add</p>
                <h2 className="text-xl font-semibold text-white">New expense</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[#2f3438] bg-transparent px-2 py-1 text-sm text-slate-400"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {validationMessage ? (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {validationMessage}
                </p>
              ) : null}

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Amount (FCFA)</span>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-[#3a3e42] bg-[#201f20] px-3 py-3 text-[18px] text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                  placeholder="1500"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Category</span>
                <select
                  name="category"
                  defaultValue="food"
                  className="w-full rounded-xl border border-[#3a3e42] bg-[#201f20] px-3 py-3 text-[18px] text-white outline-none focus:border-slate-500"
                >
                  <option value="food">Food</option>
                  <option value="transportation">Transportation</option>
                  <option value="housing">Housing</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
              </label>

              {projects.length > 0 ? (
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Project</span>
                  <select
                    name="projectId"
                    defaultValue=""
                    className="w-full rounded-xl border border-[#3a3e42] bg-[#201f20] px-3 py-3 text-[18px] text-white outline-none focus:border-slate-500"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Description</span>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full rounded-xl border border-[#3a3e42] bg-[#201f20] px-3 py-3 text-[16px] text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                  placeholder="Lunch, transport, groceries..."
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-xl border border-[#3a3e42] bg-transparent px-3 py-3 text-base font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-[#2f3438] bg-[#f8fafc] px-3 py-3 text-base font-medium text-[#111315] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Saving...' : 'Save expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
