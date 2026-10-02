import { dailyLivingBudget, isUncoveredDay, type BudgetPeriod } from '../../domain/finance/calculations'
import { settlementActions } from '../../domain/finance/settlement'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { userRepository } from '../../infrastructure/repositories/userRepository'
import { getChestsWithBalances } from './getChestsWithBalances'
import { now as clockNow } from '../../lib/clock'

// How far back days are settled when someone has been away for long.
const MAX_DAYS = 62

type SettleDeps = {
  // Marks the days up to `through` as settled. Resolves to false when
  // something else settled them in the meantime.
  claim: (userId: string, previous: Date | null, through: Date) => Promise<boolean>
  listIncomes: (userId: string) => Promise<{ createdAt: Date }[]>
  listAllocations: (userId: string) => Promise<{ name: string; amount: unknown; period: string; category: string }[]>
  listExpenses: (userId: string) => Promise<{ amount: unknown; date: Date }[]>
  listMovements: (userId: string) => Promise<{ reason: string; amount: unknown; date: Date }[]>
  listChests: (userId: string) => Promise<{ id: string; name: string; isSystem: boolean; balance: number }[]>
  createMovement: typeof financeRepository.createMovement
}

const defaultDeps: SettleDeps = {
  claim: userRepository.claimSettlement,
  listIncomes: financeRepository.listIncomes,
  listAllocations: financeRepository.listAllocations,
  listExpenses: financeRepository.listExpenses,
  listMovements: financeRepository.listMovements,
  listChests: getChestsWithBalances,
  createMovement: financeRepository.createMovement,
}

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const sameDay = (left: Date, right: Date) => dayStart(left).getTime() === dayStart(right).getTime()

// Whether every day before today is already settled, from what is known of
// the person alone. Lets a page skip the work without asking the database.
export function isSettled(settledThrough: Date | null, now: Date): boolean {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)

  return settledThrough !== null && dayStart(settledThrough) >= yesterday
}

// Settles the days that ended since the last time: what was left of each
// day's budget goes into the Buffer, and each time the chosen weekday begins
// the Buffer is emptied into the Base Chest. Nothing runs at midnight: it is
// done the next time the person opens the app, dated as if it had been.
export async function settleDays(
  user: { id: string; settledThrough: Date | null; bufferSweepDay: number },
  now: Date = clockNow(),
  deps: SettleDeps = defaultDeps,
): Promise<void> {
  if (isSettled(user.settledThrough, now)) {
    return
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const incomes = await deps.listIncomes(user.id)

  // No plan yet: there is no budget to have a leftover of.
  if (incomes.length === 0) {
    return
  }

  const setUpOn = dayStart(new Date(Math.min(...incomes.map((income) => income.createdAt.getTime()))))
  const earliest = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - (MAX_DAYS - 1))
  const afterLast = user.settledThrough
    ? new Date(user.settledThrough.getFullYear(), user.settledThrough.getMonth(), user.settledThrough.getDate() + 1)
    : setUpOn
  const firstDay = new Date(Math.max(afterLast.getTime(), setUpOn.getTime(), earliest.getTime()))

  // Taken before anything is written, so two pages opened together cannot
  // both settle the same days.
  if (!(await deps.claim(user.id, user.settledThrough, yesterday))) {
    return
  }

  if (firstDay > yesterday) {
    return
  }

  const [allocations, expenses, movements, chests] = await Promise.all([
    deps.listAllocations(user.id),
    deps.listExpenses(user.id),
    deps.listMovements(user.id),
    deps.listChests(user.id),
  ])
  const buffer = chests.find((chest) => chest.isSystem && chest.name === 'Buffer')
  const base = chests.find((chest) => chest.isSystem && chest.name === 'Base Chest')

  if (!buffer || !base) {
    return
  }

  const living = allocations
    .filter((allocation) => {
      const category = String(allocation.category ?? '').toLowerCase()
      return category === 'daily_living' || String(allocation.name ?? '').toLowerCase().includes('daily living')
    })
    .map((allocation) => ({
      amount: Number(allocation.amount || 0),
      period: (allocation.period === 'weekly' ? 'weekly' : 'monthly') as BudgetPeriod,
      category: 'daily_living',
    }))

  const totalOn = (entries: { amount: unknown; date: Date }[], day: Date) =>
    entries.filter((entry) => sameDay(new Date(entry.date), day)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const savings = movements.filter((movement) => movement.reason === 'DAILY_SAVING')

  const actions = settlementActions({
    firstDay,
    lastDay: yesterday,
    sweepDay: user.bufferSweepDay,
    bufferBalance: buffer.balance,
    leftoverOf: (day) =>
      // On a 31st the budget comes out of the chests: what is left of it is
      // still in them, so there is nothing to put aside.
      isUncoveredDay(day)
        ? 0
        : Math.max(dailyLivingBudget(living, day) - totalOn(expenses, day) - totalOn(savings, day), 0),
  })

  for (const action of actions) {
    if (action.kind === 'leftover') {
      await deps.createMovement(user.id, {
        amount: action.amount,
        type: 'IN',
        reason: 'DAILY_SAVING',
        date: action.at,
        destinationChestId: buffer.id,
      })
    } else {
      await deps.createMovement(user.id, {
        amount: action.amount,
        type: 'TRANSFER',
        reason: 'BUFFER_CONSOLIDATION',
        date: action.at,
        sourceChestId: buffer.id,
        destinationChestId: base.id,
      })
    }
  }
}
