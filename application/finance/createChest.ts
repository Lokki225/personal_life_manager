import { FinanceRuleError } from '../../domain/finance/errors'
import {
  financeRepository,
  type ChestRecord,
  type ChestRepository,
} from '../../infrastructure/repositories/financeRepository'

export type CreateChestInput = {
  name: string
  type: 'AVAILABLE' | 'SECURE'
  // Only meaningful for a secure chest: no money leaves it before this date.
  lockedUntil?: Date | null
}

export async function createChest(
  userId: string,
  input: CreateChestInput,
  repository: Pick<ChestRepository, 'listChests' | 'createChest'> = financeRepository,
  today: Date = new Date(),
): Promise<ChestRecord> {
  const name = input.name.trim()

  if (!name) {
    throw new FinanceRuleError('Enter a chest name.', 'name')
  }

  const existing = await repository.listChests(userId)

  if (existing.some((chest) => chest.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new FinanceRuleError('You already have a chest with this name.', 'name')
  }

  const lockedUntil = input.type === 'SECURE' ? (input.lockedUntil ?? null) : null

  if (lockedUntil && lockedUntil <= today) {
    throw new FinanceRuleError('Choose a date in the future.', 'lockedUntil')
  }

  return repository.createChest(userId, { name, type: input.type, isSystem: false, lockedUntil })
}
