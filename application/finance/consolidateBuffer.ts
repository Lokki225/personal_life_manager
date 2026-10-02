import { MovementReason } from '@/app/generated/prisma/enums'
import { FinanceRuleError } from '@/domain/finance/errors'

import { getChestsWithBalances } from './getChestsWithBalances'
import { transferBetweenChests } from './transferBetweenChests'

type ConsolidateDeps = {
  listChests: typeof getChestsWithBalances
  transfer: typeof transferBetweenChests
}

const defaultDeps: ConsolidateDeps = { listChests: getChestsWithBalances, transfer: transferBetweenChests }

// Sweeps everything in the Buffer into another chest: the Base Chest unless
// one is given.
export async function consolidateBuffer(
  userId: string,
  destinationChestId?: string | null,
  deps: ConsolidateDeps = defaultDeps,
) {
  const chests = await deps.listChests(userId)
  const bufferChest = chests.find((chest) => chest.isSystem && chest.name === 'Buffer')
  const destination = destinationChestId
    ? chests.find((chest) => chest.id === destinationChestId)
    : chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')

  if (!bufferChest || !destination) {
    throw new FinanceRuleError('Your Buffer or Base Chest is missing.')
  }

  if (bufferChest.balance <= 0) {
    throw new FinanceRuleError('The Buffer is empty, so there is nothing to consolidate.')
  }

  await deps.transfer(
    userId,
    bufferChest.id,
    destination.id,
    bufferChest.balance,
    MovementReason.BUFFER_CONSOLIDATION,
  )

  return { consolidated: bufferChest.balance }
}
