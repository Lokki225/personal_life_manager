import { debtOutstanding, debtTotal, formatAmount, type InterestType } from '../../domain/finance/calculations'
import { DEBTS_CHEST_NAME, isDebtChest } from '../../domain/finance/chests'
import { FinanceRuleError } from '../../domain/finance/errors'
import type { DebtDirection } from '../../domain/finance/options'
import { financeRepository } from '../../infrastructure/repositories/financeRepository'
import { ensureDefaultChests } from './ensureDefaultChests'
import { getChestsWithBalances } from './getChestsWithBalances'

type ChestForDebt = { id: string; name: string; isSystem: boolean; balance: number }

type DebtRow = {
  id: string
  direction: DebtDirection
  counterparty: string
  principal: unknown
  interestType: InterestType
  interestValue: unknown
  takenAt: Date
  dueDate: Date | null
  goal?: { id: string; name: string } | null
  payments: { amount: unknown }[]
}

type GoalForDebt = { id: string; name: string; conditions: { measurement: string; chestId: string | null }[] }

type DebtDeps = {
  // The user's chests, after making sure the Debts Chest exists.
  listChests: (userId: string) => Promise<ChestForDebt[]>
  listDebts: (userId: string) => Promise<DebtRow[]>
  listGoals: (userId: string) => Promise<GoalForDebt[]>
  createDebt: typeof financeRepository.createDebt
  addPayment: typeof financeRepository.addDebtPayment
}

const defaultDeps: DebtDeps = {
  listChests: async (userId) => {
    await ensureDefaultChests(userId)
    return getChestsWithBalances(userId)
  },
  listDebts: financeRepository.listDebts,
  listGoals: financeRepository.listGoals,
  createDebt: financeRepository.createDebt,
  addPayment: financeRepository.addDebtPayment,
}

const systemChest = (chests: ChestForDebt[], name: string) => {
  const chest = chests.find((candidate) => candidate.isSystem && candidate.name === name)

  if (!chest) {
    throw new FinanceRuleError(`Your ${name} is missing.`)
  }

  return chest
}

// Money for a loan or a repayment only leaves the Buffer, the Base Chest or
// the Debts Chest, and only when that chest holds enough.
function chestToTakeFrom(chests: ChestForDebt[], chestId: string | null | undefined, amount: number) {
  const chest = chests.find((candidate) => candidate.id === chestId)

  if (!chest || !isDebtChest(chest)) {
    throw new FinanceRuleError('Choose the Buffer, the Base Chest or the Debts Chest.', 'chestId')
  }

  if (amount > chest.balance) {
    throw new FinanceRuleError(`${chest.name} only holds ${formatAmount(chest.balance)}.`, 'amount')
  }

  return chest
}

export type DebtStatus = {
  id: string
  direction: DebtDirection
  counterparty: string
  principal: number
  // Principal plus interest.
  total: number
  paid: number
  outstanding: number
  takenAt: Date
  dueDate: Date | null
  // The goal the money was borrowed for, when there is one.
  goal: { id: string; name: string } | null
}

// The chest a goal is measured on, when it has one. Only such a goal can
// receive money.
export const goalChestId = (goal: GoalForDebt) =>
  goal.conditions.find((condition) => condition.measurement === 'chest_balance' && condition.chestId)?.chestId ?? null

export async function listDebtsWithStatus(
  userId: string,
  deps: Pick<DebtDeps, 'listDebts'> = defaultDeps,
): Promise<DebtStatus[]> {
  const debts = await deps.listDebts(userId)

  return debts.map((debt) => {
    const principal = Number(debt.principal)
    const total = debtTotal(principal, debt.interestType, Number(debt.interestValue))
    const outstanding = debtOutstanding(
      total,
      debt.payments.map((payment) => Number(payment.amount)),
    )

    return {
      id: debt.id,
      direction: debt.direction,
      counterparty: debt.counterparty,
      principal,
      total,
      paid: total - outstanding,
      outstanding,
      takenAt: debt.takenAt,
      dueDate: debt.dueDate,
      goal: debt.goal ?? null,
    }
  })
}

// Money borrowed always arrives in the Debts Chest, and goes on to a goal's
// chest when it was borrowed for that goal. Money lent leaves the chest given
// by `chestId`.
export async function recordDebt(
  input: {
    userId: string
    direction: DebtDirection
    counterparty: string
    amount: number
    interestType: InterestType
    interestValue?: number | null
    chestId?: string | null
    goalId?: string | null
    dueDate?: Date | null
  },
  deps: DebtDeps = defaultDeps,
  today: Date = new Date(),
): Promise<void> {
  const { userId, direction, counterparty, amount, interestType } = input
  const interestValue = interestType === 'NONE' ? 0 : (input.interestValue ?? 0)

  if (interestType !== 'NONE' && interestValue <= 0) {
    throw new FinanceRuleError('Enter the interest, or choose no interest.', 'interestValue')
  }

  if (interestType === 'PERCENT' && interestValue > 100) {
    throw new FinanceRuleError('Interest cannot be more than 100%.', 'interestValue')
  }

  let funding = null

  if (direction === 'BORROWED' && input.goalId) {
    const goal = (await deps.listGoals(userId)).find((candidate) => candidate.id === input.goalId)
    const chestId = goal ? goalChestId(goal) : null

    if (!goal || !chestId) {
      throw new FinanceRuleError('Choose one of your goals that has a chest.', 'goalId')
    }

    funding = { goalId: goal.id, chestId }
  }

  const chests = await deps.listChests(userId)
  const movement =
    direction === 'LENT'
      ? {
          type: 'OUT' as const,
          chestId: chestToTakeFrom(chests, input.chestId, amount).id,
          notes: `Lent to ${counterparty}`,
        }
      : {
          type: 'IN' as const,
          chestId: systemChest(chests, DEBTS_CHEST_NAME).id,
          notes: `Borrowed from ${counterparty}`,
        }

  await deps.createDebt(
    userId,
    {
      direction,
      counterparty,
      principal: amount,
      interestType,
      interestValue,
      takenAt: today,
      dueDate: input.dueDate ?? null,
      goalId: funding?.goalId ?? null,
    },
    movement,
    funding,
  )
}

// Paying back what was borrowed takes money out of the chosen chest. Money
// lent that comes back is new money: it goes to the Base Chest, like income
// that no allocation claims.
export async function repayDebt(
  input: { userId: string; debtId: string; amount: number; chestId?: string | null },
  deps: DebtDeps = defaultDeps,
  today: Date = new Date(),
): Promise<void> {
  const { userId, debtId, amount } = input
  const [debts, chests] = await Promise.all([listDebtsWithStatus(userId, deps), deps.listChests(userId)])
  const debt = debts.find((candidate) => candidate.id === debtId)

  if (!debt) {
    throw new FinanceRuleError('This debt no longer exists.')
  }

  if (debt.outstanding <= 0) {
    throw new FinanceRuleError('This debt is already settled.')
  }

  if (amount > debt.outstanding) {
    throw new FinanceRuleError(`Only ${formatAmount(debt.outstanding)} is left to repay.`, 'amount')
  }

  const movement =
    debt.direction === 'BORROWED'
      ? {
          type: 'OUT' as const,
          chestId: chestToTakeFrom(chests, input.chestId, amount).id,
          notes: `Repaid ${debt.counterparty}`,
        }
      : {
          type: 'IN' as const,
          chestId: systemChest(chests, 'Base Chest').id,
          notes: `Repaid by ${debt.counterparty}`,
        }

  await deps.addPayment(userId, debtId, { amount, date: today }, movement)
}

// The user's goals, for choosing what a debt is for.
export async function listGoalsForDebts(userId: string, deps: Pick<DebtDeps, 'listGoals'> = defaultDeps) {
  return deps.listGoals(userId)
}
