import { CURRENCY_CODE } from '../../domain/finance/calculations'
import { FinanceRuleError } from '../../domain/finance/errors'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'

type SavingsGoalDeps = {
  listChests: (userId: string) => Promise<{ name: string }[]>
  create: typeof financeRepository.createSavingsGoal
}

const defaultDeps: SavingsGoalDeps = {
  listChests: financeRepository.listChests,
  create: financeRepository.createSavingsGoal,
}

// A savings goal is a dedicated chest plus one condition: its balance must
// reach the target. Money already put aside enters as a first contribution.
// The three records are written together, so a failure leaves nothing behind.
export async function createSavingsGoal(
  userId: string,
  input: { name: string; targetAmount: number; alreadySaved?: number },
  deps: SavingsGoalDeps = defaultDeps,
) {
  const name = input.name.trim()

  if (!name) {
    throw new FinanceRuleError('Enter what you are saving for.', 'name')
  }

  if (input.targetAmount <= 0) {
    throw new FinanceRuleError('Enter a target greater than zero.', 'targetAmount')
  }

  const chests = await deps.listChests(userId)

  if (chests.some((chest) => chest.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new FinanceRuleError('You already have a chest with this name.', 'name')
  }

  return deps.create(userId, {
    name,
    targetAmount: input.targetAmount,
    alreadySaved: Math.max(input.alreadySaved ?? 0, 0),
    unit: CURRENCY_CODE,
  })
}
