import 'dotenv/config'

import { getChestsWithBalances } from '@/application/finance/getChestsWithBalances'
import { getHistory } from '@/application/finance/getHistory'
import { getReview } from '@/application/finance/getReview'
import { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { ensureDefaultChests } from '@/application/finance/ensureDefaultChests'
import { chestBalance } from '@/domain/finance/chests'
import { prisma } from '@/infrastructure/prisma/client'
import { financeRepository } from '@/infrastructure/repositories/financeRepository'
import { userRepository } from '@/infrastructure/repositories/userRepository'

// Times the Finance reads for one large account (security test plan §7.3):
// two years of expenses, 5,000 movements, 1,000 journal entries. Development
// database only; the account is deleted at the end.
//
//   npx tsx scripts/perf-large-account.ts [scale]

if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
  throw new Error('Never against production.')
}

const scale = Number(process.argv[2] ?? 1)
const DAY = 86_400_000

async function time(label: string, task: () => Promise<unknown>) {
  const runs: number[] = []
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    await task()
    runs.push(performance.now() - start)
  }
  console.log(`${label.padEnd(24)} ${Math.min(...runs).toFixed(0).padStart(6)} ms (best of 3)`)
}

async function main() {
  const user = await prisma.user.create({ data: { email: `perf-${Date.now()}@example.invalid`, passwordHash: 'x' } })
  try {
    const now = new Date()
    await financeRepository.createInitialPlan(user.id, {
      income: { source: 'Salary', amount: 300000, frequency: 'monthly', payDay: 25 },
      allocations: [{ name: 'Daily living', amount: 60000, period: 'monthly', category: 'daily_living' }],
      startDate: new Date(now.getTime() - 730 * DAY),
    })
    await ensureDefaultChests(user.id)
    const chests = await financeRepository.listChests(user.id)
    const base = chests.find((c) => c.name === 'Base Chest')!.id
    const buffer = chests.find((c) => c.name === 'Buffer')!.id

    const expenses = Array.from({ length: 2190 * scale }, (_, i) => ({
      userId: user.id,
      amount: 500 + (i % 7) * 250,
      category: ['food', 'transport', 'other'][i % 3],
      date: new Date(now.getTime() - (i % 730) * DAY),
    }))
    const movements = Array.from({ length: 5000 * scale }, (_, i) => ({
      userId: user.id,
      sourceChestId: i % 2 ? base : null,
      destinationChestId: i % 2 ? buffer : base,
      amount: 1000,
      type: (i % 2 ? 'OUT' : 'IN') as 'OUT' | 'IN',
      reason: (i % 2 ? 'WITHDRAWAL' : 'DAILY_SAVING') as 'WITHDRAWAL' | 'DAILY_SAVING',
      date: new Date(now.getTime() - (i % 730) * DAY),
    }))
    const exceptions = Array.from({ length: 200 * scale }, (_, i) => ({
      userId: user.id,
      date: new Date(now.getTime() - (i % 730) * DAY),
      category: 'food',
      plannedAmount: 2000,
      actualAmount: 3000,
      difference: 1000,
    }))
    const entries = Array.from({ length: 1000 * scale }, (_, i) => ({
      userId: user.id,
      type: 'FREE' as const,
      body: `Entry ${i}`,
      entryDate: new Date(now.getTime() - (i % 730) * DAY),
    }))
    await prisma.expense.createMany({ data: expenses })
    await prisma.moneyMovement.createMany({ data: movements })
    await prisma.budgetException.createMany({ data: exceptions })
    await prisma.journalEntry.createMany({ data: entries })
    console.log(`Seeded ×${scale}: ${expenses.length} expenses, ${movements.length} movements, ${exceptions.length} exceptions, ${entries.length} entries`)

    if (process.env.PROFILE) {
      await time('listMovements', () => financeRepository.listMovements(user.id))
      await time('movements, no include', () => prisma.moneyMovement.findMany({ where: { userId: user.id } }))
      await time('listExpenses', () => financeRepository.listExpenses(user.id))
      await time('movement groupBy', () => prisma.moneyMovement.groupBy({ by: ['destinationChestId'], where: { userId: user.id }, _sum: { amount: true } }))
      await time('one round trip', () => prisma.user.findUnique({ where: { id: user.id } }))
    }
    await time('recomputeFinanceState', () => recomputeFinanceState({ userId: user.id, referenceDate: now }))
    await time('getHistory (month)', () => getHistory({ userId: user.id, referenceDate: now }))
    await time('getReview (month)', () => getReview({ userId: user.id, referenceDate: now }))
    await time('getChestsWithBalances', () => getChestsWithBalances(user.id))

    // The database's sums must give the same balances as the movements one by one.
    const all = (await financeRepository.listMovements(user.id)).map((m) => ({ ...m, amount: Number(m.amount) }))
    const summed = await getChestsWithBalances(user.id)
    const same = summed.every((chest) => chest.balance === chestBalance(chest.id, all))
    console.log(same ? 'Balances match.' : 'BALANCES DIFFER')
  } finally {
    await userRepository.deleteAccount(user.id)
    await prisma.$disconnect()
  }
}

main()
