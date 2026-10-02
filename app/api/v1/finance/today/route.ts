import { endpoint, ok } from '../../api'
import { todayView } from '../../views'
import { financeState } from '../state'

export const GET = endpoint('READ', async (_request, user) => {
  const { state, pendingIncomes, today } = await financeState(user)

  return ok(todayView(state, pendingIncomes, today))
})
