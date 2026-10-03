import { MovementReason } from '@/app/generated/prisma/enums'
import { chestWithdrawalBlocker } from '@/domain/finance/chests'
import { FinanceRuleError } from '@/domain/finance/errors'

import { getChestsWithBalances } from './getChestsWithBalances'
import { recordMovement } from './recordMovement'
import { now as clockNow } from '../../lib/clock'

type TransferDeps = {
  listChests: typeof getChestsWithBalances
  record: typeof recordMovement
}

const defaultDeps: TransferDeps = { listChests: getChestsWithBalances, record: recordMovement }

export async function transferBetweenChests(
  userId: string,
  sourceChestId: string,
  destinationChestId: string,
  amount: number,
  reason: MovementReason,
  deps: TransferDeps = defaultDeps,
  today: Date = clockNow(),
) {
  if (sourceChestId === destinationChestId) {
    throw new FinanceRuleError('Choose two different chests.', 'destinationChestId')
  }

  const chests = await deps.listChests(userId)
  const source = chests.find((c) => c.id === sourceChestId)
  const destination = chests.find((c) => c.id === destinationChestId)

  if (!source) throw new FinanceRuleError('Choose one of your chests.', 'sourceChestId')
  if (!destination) throw new FinanceRuleError('Choose one of your chests.', 'destinationChestId')

  const blocker = chestWithdrawalBlocker(source, amount, today)
  if (blocker) {
    throw new FinanceRuleError(blocker.message, blocker.reason === 'locked' ? 'sourceChestId' : 'amount')
  }

  await deps.record({
    userId,
    type: 'TRANSFER',
    reason,
    sourceChestId: source.id,
    destinationChestId: destination.id,
    amount,
  })
}
