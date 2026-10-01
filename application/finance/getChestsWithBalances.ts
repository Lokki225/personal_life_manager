// application/finance/getChestsWithBalances.ts
import { financeRepository } from '@/infrastructure/repositories/financeRepository'
import { chestBalance, type MovementForBalance } from '@/domain/finance/chests'

export async function getChestsWithBalances(userId: string) {
  const [chests, movements] = await Promise.all([
    financeRepository.listChests(userId),
    financeRepository.listMovements(userId),
  ])

  const forBalance: MovementForBalance[] = movements.map((m) => ({
    sourceChestId: m.sourceChestId,
    destinationChestId: m.destinationChestId,
    amount: Number(m.amount),
  }))

  return chests.map((chest) => ({
    ...chest,
    balance: chestBalance(chest.id, forBalance),
  }))
}