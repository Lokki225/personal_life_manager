import { listPendingIncomes } from '@/application/finance/confirmIncome'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { settleDays } from '@/application/finance/settleDays'
import { now } from '@/lib/clock'

import type { ApiUser } from '../api'

// What the finance endpoints start from. As on the pages, the days that ended
// since the last visit are closed first, so the figures are the same ones the
// person sees in the app.
export async function financeState(user: ApiUser) {
  await settleDays(user)

  const today = now()
  const [state, pendingIncomes] = await Promise.all([
    recomputeFinanceState({ userId: user.id, referenceDate: today }),
    listPendingIncomes(user.id, today),
  ])

  return { state, pendingIncomes, today }
}
