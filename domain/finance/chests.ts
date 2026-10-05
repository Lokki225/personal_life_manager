// domain/finance/chests.ts — no Prisma import at all
import { formatAmount } from './calculations'

export interface MovementForBalance {
  sourceChestId: string | null
  destinationChestId: string | null
  amount: number
}

export function chestBalance(chestId: string, movements: MovementForBalance[]): number {
  return movements.reduce((balance, m) => {
    if (m.destinationChestId === chestId) return balance + m.amount
    if (m.sourceChestId === chestId) return balance - m.amount
    return balance
  }, 0)
}

// The same balances from totals the database summed: what came into each chest
// and what left it. Money never moves from a chest to itself.
export function balancesFromTotals(
  inflows: { chestId: string | null; amount: number }[],
  outflows: { chestId: string | null; amount: number }[],
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const { chestId, amount } of inflows) if (chestId) balances.set(chestId, (balances.get(chestId) ?? 0) + amount)
  for (const { chestId, amount } of outflows) if (chestId) balances.set(chestId, (balances.get(chestId) ?? 0) - amount)
  return balances
}

// The built-in chest that holds borrowed money. It is not savings.
export const DEBTS_CHEST_NAME = 'Debts Chest'

const DEBT_CHEST_NAMES = ['Buffer', 'Base Chest', DEBTS_CHEST_NAME]

// The chests money for a loan or a debt repayment may come out of.
export function isDebtChest(chest: { name: string; isSystem: boolean }): boolean {
  return chest.isSystem && DEBT_CHEST_NAMES.includes(chest.name)
}

// Whether an expense was paid with money from a chest rather than the day's
// budget. Such an expense never counts against the budget.
export const isPaidFromChest = (expense: { paidFromChestName?: string | null }) => Boolean(expense.paidFromChestName)

// Why this chest cannot give that amount today, or null when it can. A secure
// chest gives nothing before its date, and no chest gives more than it holds.
export function chestWithdrawalBlocker(
  chest: { name: string; type: string; lockedUntil?: Date | null; balance: number },
  amount: number,
  today: Date,
): { reason: 'locked' | 'short'; message: string } | null {
  if (chest.type === 'SECURE' && chest.lockedUntil && chest.lockedUntil > today) {
    return { reason: 'locked', message: `${chest.name} is locked until ${chest.lockedUntil.toLocaleDateString('en-GB')}.` }
  }

  if (amount > chest.balance) {
    return { reason: 'short', message: `${chest.name} only holds ${formatAmount(Math.max(chest.balance, 0))}.` }
  }

  return null
}
