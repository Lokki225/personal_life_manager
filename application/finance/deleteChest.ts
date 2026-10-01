import { formatAmount } from '@/domain/finance/calculations'
import { FinanceRuleError } from '@/domain/finance/errors'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'

import { getChestsWithBalances } from './getChestsWithBalances'

type DeleteChestDeps = {
  listChests: (userId: string) => Promise<{ id: string; name: string; isSystem: boolean; balance: number }[]>
  listGoals: (userId: string) => Promise<{ name: string; conditions: { chestId: string | null }[] }[]>
  remove: (userId: string, chestId: string) => Promise<void>
}

const defaultDeps: DeleteChestDeps = {
  listChests: getChestsWithBalances,
  listGoals: financeRepository.listGoals,
  remove: financeRepository.removeChest,
}

// Why a chest cannot be deleted, or null when it can. Shared with the page so
// the delete button only shows when it would work.
export function chestDeletionBlocker(
  chest: { id: string; name: string; isSystem: boolean; balance: number },
  goals: { name: string; conditions: { chestId: string | null }[] }[],
): string | null {
  if (chest.isSystem) {
    return 'Built-in chests cannot be deleted.'
  }

  if (Math.abs(chest.balance) >= 1) {
    return `Move the ${formatAmount(chest.balance)} out of ${chest.name} first.`
  }

  const goal = goals.find((candidate) => candidate.conditions.some((condition) => condition.chestId === chest.id))

  return goal ? `${chest.name} is used by the goal "${goal.name}".` : null
}

export async function deleteChest(userId: string, chestId: string, deps: DeleteChestDeps = defaultDeps): Promise<void> {
  const [chests, goals] = await Promise.all([deps.listChests(userId), deps.listGoals(userId)])
  const chest = chests.find((candidate) => candidate.id === chestId)

  if (!chest) {
    throw new FinanceRuleError('This chest no longer exists.')
  }

  const blocker = chestDeletionBlocker(chest, goals)

  if (blocker) {
    throw new FinanceRuleError(blocker)
  }

  await deps.remove(userId, chestId)
}

// Every chest of the user, each with the reason it cannot be deleted (or null).
export async function listChestsForManagement(userId: string) {
  const [chests, goals] = await Promise.all([
    getChestsWithBalances(userId),
    financeRepository.listGoals(userId),
  ])

  return chests.map((chest) => ({ ...chest, deletionBlocker: chestDeletionBlocker(chest, goals) }))
}
