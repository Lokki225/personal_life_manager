import { chestBalance, DEBTS_CHEST_NAME } from '../finance/chests'

import type { Point, Resolve } from './engine'

// The Finance measurement sources, over data the caller already loaded.

export type FinanceEvidence = {
  movements: {
    sourceChestId: string | null
    destinationChestId: string | null
    amount: number
    date: Date
    reason?: string
    type?: string
  }[]
  // Each budget exception with its date and how far over it went.
  exceptions: { date: Date; difference: number }[]
  expenses?: { date: Date; amount: number; category: string; paidFromChest: boolean }[]
  chests?: { id: string; name: string; isSystem: boolean }[]
  // What is still owed on each borrowed debt.
  debtsOwed?: number[]
}

// The balance of a chest after each movement that touched it, in date order.
// Its last point is the chest's balance today.
export function chestBalancePoints(chestId: string, movements: FinanceEvidence['movements']): Point[] {
  const touching = movements
    .filter((m) => m.destinationChestId === chestId || m.sourceChestId === chestId)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  let balance = 0
  return touching.map((m) => {
    balance += m.destinationChestId === chestId ? m.amount : -m.amount
    return { at: m.date, value: balance }
  })
}

// One point per exception: COUNT counts them, SUM adds how far over they went.
export function budgetExceptionPoints(exceptions: FinanceEvidence['exceptions']): Point[] {
  return exceptions.map((e) => ({ at: e.date, value: Math.max(e.difference, 0) }))
}

// What the budget paid for, as the Today and Review pages count it: expenses
// not paid from a chest, less what the reserves paid on a 31st. In one
// category, only that category's expenses.
export function budgetSpendingPoints(evidence: FinanceEvidence, category: string | null): Point[] {
  const expenses = (evidence.expenses ?? [])
    .filter((e) => !e.paidFromChest && (category === null || e.category === category))
    .map((e) => ({ at: e.date, value: e.amount }))

  if (category !== null) {
    return expenses
  }

  const reserveDraws = evidence.movements
    .filter((m) => m.reason === 'EXPENSE' && m.type === 'OUT')
    .map((m) => ({ at: m.date, value: -m.amount }))

  return [...expenses, ...reserveDraws]
}

const SAVING_REASONS = ['DAILY_SAVING', 'PLANNED_SAVING']

// Money put into a chest as a daily or planned saving.
export function savingsInPoints(movements: FinanceEvidence['movements']): Point[] {
  return movements
    .filter((m) => m.destinationChestId && m.reason && SAVING_REASONS.includes(m.reason))
    .map((m) => ({ at: m.date, value: m.amount }))
}

// Everything saved outside the Buffer; the Debts Chest holds borrowed money,
// which is not savings. Same rule as the Today page's savings total.
export function totalSavings(evidence: FinanceEvidence): number {
  return (evidence.chests ?? [])
    .filter((c) => !(c.isSystem && (c.name === 'Buffer' || c.name === DEBTS_CHEST_NAME)))
    .reduce((sum, c) => sum + Math.max(chestBalance(c.id, evidence.movements), 0), 0)
}

export function financeResolver(evidence: FinanceEvidence, now: Date): Resolve {
  return (condition) => {
    switch (condition.source) {
      case 'CHEST_BALANCE': {
        const chestId = condition.sourceRef.chestId

        if (typeof chestId !== 'string') {
          throw new Error(`Condition ${condition.id} is missing a chestId`)
        }
        return chestBalancePoints(chestId, evidence.movements)
      }
      case 'BUDGET_EXCEPTIONS':
        return budgetExceptionPoints(evidence.exceptions)
      case 'BUDGET_SPENDING': {
        const category = condition.sourceRef.category
        return budgetSpendingPoints(evidence, typeof category === 'string' ? category : null)
      }
      case 'SAVINGS_IN':
        return savingsInPoints(evidence.movements)
      // Values known only as they are now: one point, today.
      case 'SAVINGS_TOTAL':
        return [{ at: now, value: totalSavings(evidence) }]
      case 'DEBT_OWED':
        return [{ at: now, value: (evidence.debtsOwed ?? []).reduce((sum, owed) => sum + owed, 0) }]
      default:
        throw new Error(`No measurement source for ${condition.source}`)
    }
  }
}
