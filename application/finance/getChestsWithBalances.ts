// application/finance/getChestsWithBalances.ts
import { financeRepository } from '@/infrastructure/repositories/financeRepository'
import { balancesFromTotals } from '@/domain/finance/chests'

// The balances are summed by the database, so this stays quick however many
// movements an account has.
export async function getChestsWithBalances(userId: string) {
  const [chests, totals] = await Promise.all([financeRepository.listChests(userId), financeRepository.chestTotals(userId)])
  const balances = balancesFromTotals(totals.inflows, totals.outflows)

  return chests.map((chest) => ({
    ...chest,
    balance: balances.get(chest.id) ?? 0,
  }))
}
