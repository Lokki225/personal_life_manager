import { chestWithdrawalBlocker } from '../../domain/finance/chests'
import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'
import { getChestsWithBalances } from './getChestsWithBalances'

type ChestForSpending = {
  id: string
  name: string
  type: string
  lockedUntil: Date | null
  balance: number
}

type ChestExpenseDeps = {
  listChests: (userId: string) => Promise<ChestForSpending[]>
  create: typeof financeRepository.createChestExpense
}

const defaultDeps: ChestExpenseDeps = {
  listChests: getChestsWithBalances,
  create: financeRepository.createChestExpense,
}

// Records an expense paid with money already set aside in a chest: the money
// leaves that chest at once, and today's budget is left as it was. So it can
// never go over the day, and is never an exception.
export async function recordChestExpense(
  input: {
    userId: string
    chestId: string
    amount: number
    category: string
    description?: string | null
  },
  deps: ChestExpenseDeps = defaultDeps,
  today: Date = clockNow(),
): Promise<void> {
  const chest = (await deps.listChests(input.userId)).find((candidate) => candidate.id === input.chestId)

  if (!chest) {
    throw new FinanceRuleError('Choose one of your chests.', 'chestId')
  }

  const blocker = chestWithdrawalBlocker(chest, input.amount, today)

  if (blocker) {
    throw new FinanceRuleError(blocker.message, blocker.reason === 'locked' ? 'chestId' : 'amount')
  }

  await deps.create(input.userId, {
    amount: input.amount,
    category: input.category,
    description: input.description?.trim() || null,
    date: today,
    chestId: chest.id,
    chestName: chest.name,
  })
}
