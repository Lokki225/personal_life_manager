import { FinanceRuleError } from '../../domain/finance/errors'
import { recomputeFinanceState } from './recomputeFinanceState'
import { recordMovement } from './recordMovement'

type CoverDeps = {
  getToday: (userId: string) => Promise<{
    dailyOverspend: number
    uncoveredDay: boolean
    chests: { id: string; name: string; isSystem: boolean; balance: number }[]
  }>
  record: typeof recordMovement
}

const defaultDeps: CoverDeps = {
  getToday: (userId) => recomputeFinanceState({ userId }),
  record: recordMovement,
}

// Pays today's overspend out of the Buffer, as far as the Buffer goes. That
// is what the Buffer is for: the day is no longer over, and the Buffer shows
// what was really put aside.
export async function coverOverspend(userId: string, deps: CoverDeps = defaultDeps): Promise<number> {
  const state = await deps.getToday(userId)
  const buffer = state.chests.find((chest) => chest.isSystem && chest.name === 'Buffer')

  // On a 31st the day is already paid out of the chests.
  if (state.dailyOverspend <= 0 || state.uncoveredDay) {
    throw new FinanceRuleError('Today is within budget, so there is nothing to cover.')
  }

  const amount = Math.min(Math.floor(state.dailyOverspend), Math.floor(buffer?.balance ?? 0))

  if (!buffer || amount < 1) {
    throw new FinanceRuleError('The Buffer is empty.')
  }

  await deps.record({
    userId,
    amount,
    type: 'OUT',
    reason: 'EXPENSE',
    sourceChestId: buffer.id,
    notes: 'Covered overspend',
  })

  return amount
}
