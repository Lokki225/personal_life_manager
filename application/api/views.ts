import type { PendingIncome } from '@/application/finance/confirmIncome'
import type { DebtStatus } from '@/application/finance/debts'
import type { HistoryEvent } from '@/application/finance/getHistory'
import type { GetReviewResult } from '@/application/finance/getReview'
import type { recomputeFinanceState } from '@/application/finance/recomputeFinanceState'
import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { DEBTS_CHEST_NAME } from '@/domain/finance/chests'

import { localTime } from './operation'

// How the app's data is shown to a program: plain names, whole numbers of the
// currency, dates on the owner's clock. Kept apart from the pages' wording so
// the API stays stable when a screen changes.

type FinanceState = Awaited<ReturnType<typeof recomputeFinanceState>>

const expenseView = (expense: FinanceState['dailyExpenses'][number]) => ({
  id: expense.id,
  amount: expense.amount,
  category: expense.category,
  description: expense.description ?? null,
  at: localTime(expense.date),
  // The chest that paid for it; null when today's budget did.
  paidFromChest: expense.paidFromChest,
})

export function todayView(state: FinanceState, pendingIncomes: PendingIncome[], now: Date) {
  return {
    date: localTime(now)!.slice(0, 10),
    currency: CURRENCY_CODE,
    // 'none' when the plan gives no daily budget.
    status: state.dailyBudget <= 0 ? 'none' : state.dailyOverspend > 0 ? 'over' : 'within',
    budget: state.dailyBudget,
    // What today's budget paid for; expenses paid from chests are not in it.
    spent: state.dailySpent,
    saved: state.savedToday,
    left: state.dailyRemaining,
    over: state.dailyOverspend,
    // Taken from the Buffer today to pay for an overspend; part of `budget`.
    coveredFromBuffer: state.coveredToday,
    // What could still be put in a chest today.
    savable: Math.floor(state.dailySaving),
    overspendExplained: state.overspendExplained,
    expenses: state.dailyExpenses.map(expenseView),
    incomesToConfirm: pendingIncomes,
    month: {
      budget: state.periodBudget,
      spent: state.monthlySpent,
      left: state.monthlyRemaining,
      exceptions: state.exceptionCount,
    },
  }
}

export function planView(state: FinanceState) {
  return {
    currency: CURRENCY_CODE,
    incomeTotal: state.incomeTotal,
    allocationTotal: state.allocationTotal,
    unallocated: state.incomeTotal - state.allocationTotal,
    dailyBudget: state.dailyBudget - state.coveredToday,
    incomes: state.incomes,
    allocations: state.allocationBreakdown,
  }
}

export function chestsView(state: FinanceState) {
  return {
    currency: CURRENCY_CODE,
    // Everything in the chests except borrowed money.
    total: state.totalSaved,
    chests: state.chests.map((chest) => ({
      id: chest.id,
      name: chest.name,
      // 'SECURE' chests can be locked until a date.
      type: chest.type,
      builtIn: chest.isSystem,
      holdsBorrowedMoney: chest.isSystem && chest.name === DEBTS_CHEST_NAME,
      balance: chest.balance,
    })),
  }
}

export function goalsView(state: FinanceState) {
  return state.goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    reached: goal.satisfied,
    borrowed: goal.borrowed,
    stillOwed: goal.owed,
    conditions: goal.conditionResults.map((result) => ({
      measurement: result.measurement,
      operator: result.operator,
      target: result.target,
      actual: result.actual,
      met: result.satisfied,
    })),
  }))
}

export function debtsView(debts: DebtStatus[]) {
  return debts.map((debt) => ({
    id: debt.id,
    // 'BORROWED' is money the person owes, 'LENT' money owed to them.
    direction: debt.direction,
    counterparty: debt.counterparty,
    principal: debt.principal,
    totalWithInterest: debt.total,
    repaid: debt.paid,
    outstanding: debt.outstanding,
    settled: debt.outstanding <= 0,
    takenAt: localTime(debt.takenAt),
    dueDate: localTime(debt.dueDate),
    goal: debt.goal,
  }))
}

export function historyView(events: HistoryEvent[]) {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    at: localTime(event.date),
    amount: event.amount,
    label: event.label,
    category: event.category ?? null,
    reason: event.reason ?? null,
    movement: event.type === 'movement' ? (event.movementType ?? null) : null,
    fromChest: event.sourceChestName ?? null,
    toChest: event.destinationChestName ?? null,
  }))
}

export function reviewView(review: GetReviewResult) {
  return {
    currency: CURRENCY_CODE,
    period: review.period,
    month: {
      plannedBudget: review.plannedBudget,
      spent: review.actualSpent,
      left: review.remaining,
      exceptions: review.exceptionCount,
    },
    savedInChests: review.actualSavings + review.buffer,
    // Expenses paid with money from chests over the period, outside the budget.
    paidFromChests: review.paidFromChests,
    ofWhichBuffer: review.buffer,
    spendingByCategory: review.categoryBreakdown,
    overspendByCategory: review.exceptionBreakdown,
    // Per day for a week or a month, per month for a year. Null for one day.
    trend: review.trend
      ? {
          budgetPerBucket: review.trend.budget,
          buckets: review.trend.buckets.map((bucket, index) => ({
            start: localTime(bucket.start)!.slice(0, 10),
            spent: review.trend!.spent[index],
            savedInChests: review.trend!.saved[index],
          })),
        }
      : null,
  }
}
