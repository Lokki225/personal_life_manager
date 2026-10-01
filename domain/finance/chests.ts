// domain/finance/chests.ts — no Prisma import at all
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