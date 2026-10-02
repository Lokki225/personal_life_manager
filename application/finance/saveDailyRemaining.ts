import { formatAmount } from '../../domain/finance/calculations'
import { FinanceRuleError } from '../../domain/finance/errors'
import { ensureDefaultChests } from './ensureDefaultChests'
import { getChestsWithBalances } from './getChestsWithBalances'
import { recomputeFinanceState } from './recomputeFinanceState'
import { recordDailySaving } from './recordDailySaving'

type SaveDailyRemainingDeps = {
  getAvailable: (userId: string) => Promise<number>
  listChests: (userId: string) => Promise<{ id: string; name: string; isSystem: boolean }[]>
  ensureChests: (userId: string) => Promise<unknown>
  record: (userId: string, amount: number, destinationChestId: string) => Promise<unknown>
}

const defaultDeps: SaveDailyRemainingDeps = {
  getAvailable: async (userId) => (await recomputeFinanceState({ userId })).dailySaving,
  listChests: getChestsWithBalances,
  ensureChests: ensureDefaultChests,
  record: recordDailySaving,
}

// Puts what is left of today's budget into a chest. Without a chosen chest it
// goes to the Buffer.
export async function saveDailyRemaining(
  input: { userId: string; amount: number; destinationChestId?: string | null },
  deps: SaveDailyRemainingDeps = defaultDeps,
): Promise<void> {
  const { userId, amount, destinationChestId } = input
  const available = await deps.getAvailable(userId)

  if (available <= 0) {
    throw new FinanceRuleError('There is nothing left to save today.')
  }

  if (amount > available) {
    throw new FinanceRuleError(`You can save at most ${formatAmount(available)} today.`, 'amount')
  }

  let chests = await deps.listChests(userId)

  if (chests.length === 0) {
    await deps.ensureChests(userId)
    chests = await deps.listChests(userId)
  }

  const chest = destinationChestId
    ? chests.find((candidate) => candidate.id === destinationChestId)
    : chests.find((candidate) => candidate.isSystem && candidate.name === 'Buffer')

  if (!chest) {
    throw new FinanceRuleError('Choose one of your chests.', 'destinationChestId')
  }

  await deps.record(userId, amount, chest.id)
}
