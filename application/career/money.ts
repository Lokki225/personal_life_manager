import { runway } from '../../domain/career/money'
import { startOfDay } from '../../domain/career/week'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'
import { getChestsWithBalances } from '../finance/getChestsWithBalances'

// The runway tile (Career spec §10): how many months the money at hand
// covers the plan, from Finance's chests and allocations.
export async function getRunway(userId: string, now: Date = clockNow()) {
  const [chests, allocations] = await Promise.all([getChestsWithBalances(userId), financeRepository.listAllocations(userId)])
  return {
    ...runway(
      {
        chests: chests.map((c) => ({ name: c.name, isSystem: c.isSystem, type: c.type, lockedUntil: c.lockedUntil, balance: c.balance })),
        allocations: allocations.map((a) => ({ amount: Number(a.amount), period: a.period, category: a.category })),
      },
      startOfDay(now),
    ),
    asOf: now,
    hasPlan: allocations.length > 0,
  }
}
