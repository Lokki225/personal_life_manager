import { MovementReason } from '@/app/generated/prisma/enums'
import { formatAmount } from '@/domain/finance/calculations'
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

  const isLocked = source.type === 'SECURE' && source.lockedUntil && source.lockedUntil > today
  if (isLocked) {
    throw new FinanceRuleError(
      `${source.name} is locked until ${source.lockedUntil!.toLocaleDateString('en-GB')}.`,
      'sourceChestId',
    )
  }

  if (amount > source.balance) {
    throw new FinanceRuleError(`${source.name} only holds ${formatAmount(source.balance)}.`, 'amount')
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
