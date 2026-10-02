import { recordDailyExpense } from '@/application/finance/recordDailyExpense'

import { endpoint, ok, readBody } from '../../api'
import { todayView } from '../../views'
import { financeState } from '../state'
import { newExpense } from './schema'

// Records an expense made today and answers with the day as it now stands.
// An expense larger than what was left is recorded as an exception too.
export const POST = endpoint('WRITE', async (request, user) => {
  const expense = await readBody(request, newExpense)

  // Closes the days that ended first, so the expense lands on a settled day.
  await financeState(user)
  await recordDailyExpense({
    userId: user.id,
    amount: expense.amount,
    category: expense.category,
    description: expense.description || null,
    cause: expense.cause ?? null,
    reason: expense.reason || null,
  })

  const { state, pendingIncomes, today } = await financeState(user)

  return ok(todayView(state, pendingIncomes, today), 201)
})
