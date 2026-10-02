import { planChestMoves, planDeposits, type BudgetPeriod } from '../../domain/finance/calculations'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { getChestsWithBalances } from './getChestsWithBalances'
import { recordMovement } from './recordMovement'

type SyncDeps = {
  listAllocations: (userId: string) => Promise<{ amount: unknown; period: string; category: string }[]>
  listReceipts: (userId: string, periodStart: Date) => Promise<{ amount: unknown }[]>
  listChests: (
    userId: string,
  ) => Promise<{ id: string; name: string; type: string; isSystem: boolean; lockedUntil: Date | null; balance: number }[]>
  listMovements: (
    userId: string,
  ) => Promise<
    { reason: string; date: Date; amount: unknown; sourceChestId: string | null; destinationChestId: string | null }[]
  >
  record: typeof recordMovement
}

const defaultDeps: SyncDeps = {
  listAllocations: financeRepository.listAllocations,
  listReceipts: financeRepository.listIncomeReceipts,
  listChests: getChestsWithBalances,
  listMovements: financeRepository.listMovements,
  record: recordMovement,
}

const NOTE = 'Plan change'

// Brings the chests in line with the plan for the current month. Of the
// income received this month, the savings allocations belong in "Monthly
// Savings" and what no allocation claims belongs in the Base Chest. After the
// plan changes, the difference with what was already placed is moved: a new
// savings allocation takes its money from the Base Chest, and so on. Running
// it again when nothing changed moves nothing.
export async function syncPlanToChests(
  userId: string,
  now: Date = new Date(),
  deps: SyncDeps = defaultDeps,
): Promise<void> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const [allocations, receipts, chests, movements] = await Promise.all([
    deps.listAllocations(userId),
    deps.listReceipts(userId, monthStart),
    deps.listChests(userId),
    deps.listMovements(userId),
  ])

  const received = receipts.reduce((total, receipt) => total + Number(receipt.amount || 0), 0)
  const base = chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')

  // No income counted this month yet: nothing was placed, so nothing to move.
  if (received <= 0 || !base) {
    return
  }

  // Money with no chest of its own always lands in the Base Chest.
  const savings = chests.find((chest) => chest.name === 'Monthly Savings') ?? base
  const savingsLocked = savings.type === 'SECURE' && savings.lockedUntil !== null && savings.lockedUntil > now

  const target = planDeposits(
    {
      incomes: [{ amount: received, frequency: 'monthly' }],
      allocations: allocations.map((allocation) => ({
        amount: Number(allocation.amount || 0),
        period: (allocation.period === 'weekly' ? 'weekly' : 'monthly') as BudgetPeriod,
        category: allocation.category,
      })),
    },
    now,
  )

  // What the plan already put in, or took out of, a chest this month.
  const placedIn = (chestId: string) =>
    movements
      .filter((movement) => movement.reason === 'PLANNED_SAVING' && movement.date >= monthStart && movement.date <= monthEnd)
      .reduce(
        (total, movement) =>
          total +
          (movement.destinationChestId === chestId ? Number(movement.amount) : 0) -
          (movement.sourceChestId === chestId ? Number(movement.amount) : 0),
        0,
      )

  const moves = planChestMoves({
    target,
    placed: { savings: placedIn(savings.id), unallocated: placedIn(base.id) },
    // A locked chest gives nothing back.
    balances: { savings: savingsLocked ? 0 : savings.balance, base: base.balance },
    oneChest: savings.id === base.id,
  })

  for (const move of moves) {
    const movement = { userId, amount: move.amount, reason: 'PLANNED_SAVING' as const, notes: NOTE }

    if (move.kind === 'toSavings') {
      await deps.record({ ...movement, type: 'TRANSFER', sourceChestId: base.id, destinationChestId: savings.id })
    } else if (move.kind === 'toBase') {
      await deps.record({ ...movement, type: 'TRANSFER', sourceChestId: savings.id, destinationChestId: base.id })
    } else if (move.kind === 'in') {
      await deps.record({ ...movement, type: 'IN', destinationChestId: base.id })
    } else {
      await deps.record({ ...movement, type: 'OUT', sourceChestId: base.id })
    }
  }
}
