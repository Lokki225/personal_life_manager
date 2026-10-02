import { editExpense, removeExpense } from '@/application/finance/manageExpense'

import { endpoint, fail, ok, readBody } from '../../../api'
import { todayView } from '../../../views'
import { financeState } from '../../state'
import { expenseChange } from '../schema'

type Context = RouteContext<'/api/v1/finance/expenses/[id]'>

const NOT_TODAY = 'No expense of today has this id. Only expenses of today can be changed.'

// Corrects one of the expenses of today. Fields left out keep their value.
export const PATCH = endpoint('WRITE', async (request, user, context: Context) => {
  const { id } = await context.params
  const change = await readBody(request, expenseChange)
  const current = (await financeState(user)).state.dailyExpenses.find((expense) => expense.id === id)

  if (!current) {
    return fail(404, 'not_found', NOT_TODAY)
  }

  await editExpense(user.id, {
    id,
    amount: change.amount ?? current.amount,
    category: change.category ?? current.category,
    description: change.description === undefined ? current.description : change.description,
  })

  const { state, pendingIncomes, today } = await financeState(user)

  return ok(todayView(state, pendingIncomes, today))
})

export const DELETE = endpoint('WRITE', async (_request, user, context: Context) => {
  const { id } = await context.params

  if (!(await financeState(user)).state.dailyExpenses.some((expense) => expense.id === id)) {
    return fail(404, 'not_found', NOT_TODAY)
  }

  await removeExpense(user.id, id)

  const { state, pendingIncomes, today } = await financeState(user)

  return ok(todayView(state, pendingIncomes, today))
})
