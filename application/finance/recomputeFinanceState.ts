import {
  dailyLivingBudget,
  debtOutstanding,
  debtTotal,
  isUncoveredDay,
  monthlyAmount,
  monthlyLivingBudget,
  uncoveredDayBudget,
  type BudgetPeriod,
} from '../../domain/finance/calculations'
import { chestBalance, DEBTS_CHEST_NAME, type MovementForBalance } from '../../domain/finance/chests'
import { evaluateGoal } from './evaluateGoal'
import {
  financeRepository,
  type AllocationRepository,
  type BudgetExceptionRepository,
  type DebtRepository,
  type ExpenseRepository,
  type IncomeRepository,
  type ChestRepository,
  type MovementRepository,
  type GoalRepository,
} from '../../infrastructure/repositories/financeRepository'
import { now as clockNow } from '../../lib/clock'

export type RecomputeFinanceStateInput = {
  userId: string
  referenceDate?: Date
  repository?: Partial<IncomeRepository> &
    Partial<AllocationRepository> &
    Partial<ExpenseRepository> &
    Partial<BudgetExceptionRepository> &
    Partial<ChestRepository> &
    Partial<MovementRepository> &
    Partial<GoalRepository> &
    Partial<DebtRepository>
}

export async function recomputeFinanceState(input: RecomputeFinanceStateInput): Promise<{
  incomeTotal: number
  allocationTotal: number
  dailyLivingAllocation: number
  expenseTotal: number
  remaining: number
  dailyBudget: number
  periodBudget: number
  dailySpent: number
  dailyRemaining: number
  dailyOverspend: number
  monthlySpent: number
  monthlyRemaining: number
  monthlyOverspend: number
  dailySaving: number
  // What was moved to a chest from today's budget.
  savedToday: number
  // The 31st: the plan covers 30 days, so the budget comes from the reserves.
  uncoveredDay: boolean
  // What the reserves (Buffer and Base Chest) still owe to today's budget.
  reserveBudgetLeft: number
  // Taken out of the Buffer today to pay for an overspend.
  coveredToday: number
  incomes: Array<{ id: string; source: string; amount: number; payDay: number }>
  overspending: number
  actualSavings: number
  buffer: number
  // Everything held in chests, buffer included.
  totalSaved: number
  // Exceptions recorded in the current month.
  exceptionCount: number
  // Whether today's overspend already has an exception.
  overspendExplained: boolean
  dailyExpenses: Array<{
    id: string
    amount: number
    category: string
    date: Date
    description?: string | null
    projectName?: string | null
  }>
  allocationBreakdown: Array<{ id: string; name: string; amount: number; category: string; period: string }>
  chests: Array<{ id: string; name: string; type: string; isSystem: boolean; balance: number }>
  goals: Array<{
    id: string
    name: string
    satisfied: boolean
    // Money borrowed for this goal, and how much of those debts is still owed.
    borrowed: number
    owed: number
    conditionResults: Array<{ measurement: string; operator: string; target: number; actual: number; satisfied: boolean }>
  }>
}> {
  const { userId, referenceDate = clockNow(), repository = financeRepository } = input

  const listIncomes = repository.listIncomes ?? financeRepository.listIncomes
  const listAllocations = repository.listAllocations ?? financeRepository.listAllocations
  const listExpenses = repository.listExpenses ?? financeRepository.listExpenses
  const listBudgetExceptions = repository.listBudgetExceptions ?? financeRepository.listBudgetExceptions
  const listChests = repository.listChests ?? financeRepository.listChests
  const listMovements = repository.listMovements ?? financeRepository.listMovements
  const listGoals = repository.listGoals ?? financeRepository.listGoals
  const listDebts = repository.listDebts ?? financeRepository.listDebts

  const [incomes, allocations, expenses, budgetExceptions, chests, rawMovements, goals, debts] =
    await Promise.all([
      listIncomes(userId),
      listAllocations(userId),
      listExpenses(userId),
      listBudgetExceptions(userId),
      listChests(userId),
      listMovements(userId),
      listGoals(userId),
      listDebts(userId),
    ])

  const incomeTotal = incomes.reduce<number>((sum, income) => sum + Number(income.amount || 0), 0)
  // Per month, so a weekly allocation is comparable with a monthly income.
  const allocationTotal = allocations.reduce<number>(
    (sum, allocation) =>
      sum +
      monthlyAmount(
        Number(allocation.amount || 0),
        allocation.period === 'weekly' ? 'weekly' : 'monthly',
        referenceDate,
      ),
    0,
  )
  const dailyLivingAllocations = allocations
    .filter((allocation) => {
      const category = String(allocation.category ?? '').toLowerCase()
      const name = String(allocation.name ?? '').toLowerCase()
      return category === 'daily_living' || name.includes('daily living')
    })
    .map((allocation) => ({
      amount: Number(allocation.amount || 0),
      period: (allocation.period === 'weekly' ? 'weekly' : 'monthly') as BudgetPeriod,
      category: 'daily_living',
    }))
  const dailyLivingAllocation = dailyLivingAllocations.reduce<number>(
    (sum, allocation) => sum + allocation.amount,
    0,
  )

  const expenseTotal = expenses.reduce<number>((sum, expense) => sum + Number(expense.amount || 0), 0)

  // The stored allocation is an amount per period, so the daily budget is that
  // amount spread over the period, and the month budget is what was allocated.
  const plannedDailyBudget = dailyLivingBudget(dailyLivingAllocations, referenceDate)
  const periodBudget = monthlyLivingBudget(dailyLivingAllocations, referenceDate)

  const startOfPeriod = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const endOfPeriod = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999)
  const today = new Date(referenceDate)

  const dailyExpenses = expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date ?? new Date())
      return (
        expenseDate.getFullYear() === today.getFullYear() &&
        expenseDate.getMonth() === today.getMonth() &&
        expenseDate.getDate() === today.getDate()
      )
    })
    .map((expense) => ({
      id: String(expense.id),
      amount: Number(expense.amount || 0),
      category: String(expense.category ?? 'other'),
      date: new Date(expense.date ?? new Date()),
      description: expense.description ?? null,
      projectName: expense.project?.name ?? null,
    }))

  const dailySpent = dailyExpenses.reduce<number>((sum, expense) => sum + expense.amount, 0)

  const isToday = (value: Date | string) => {
    const date = new Date(value)
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  // Spending paid out of the reserves on a 31st. It is not the plan's money.
  const reserveDraws = rawMovements.filter((m) => m.reason === 'EXPENSE' && m.type === 'OUT')
  const drawnToday = reserveDraws
    .filter((m) => isToday(m.date))
    .reduce<number>((sum, m) => sum + Number(m.amount || 0), 0)
  const drawnThisMonth = reserveDraws
    .filter((m) => {
      const moveDate = new Date(m.date)
      return moveDate >= startOfPeriod && moveDate <= endOfPeriod
    })
    .reduce<number>((sum, m) => sum + Number(m.amount || 0), 0)

  const monthlySpent =
    expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date ?? new Date())
        return expenseDate >= startOfPeriod && expenseDate <= endOfPeriod
      })
      .reduce<number>((sum, expense) => sum + Number(expense.amount || 0), 0) - drawnThisMonth

  // --- Chests & movements replace the old Saving model ---
  const movements: MovementForBalance[] = rawMovements.map((m) => ({
    sourceChestId: m.sourceChestId,
    destinationChestId: m.destinationChestId,
    amount: Number(m.amount),
  }))

  const chestsWithBalances = chests.map((chest) => ({
    id: chest.id,
    name: chest.name,
    type: chest.type,
    isSystem: chest.isSystem,
    balance: chestBalance(chest.id, movements),
  }))

  const bufferChest = chestsWithBalances.find((c) => c.isSystem && c.name === 'Buffer')
  const buffer = bufferChest ? Math.max(bufferChest.balance, 0) : 0

  // "Actual savings" = everything saved OUTSIDE the buffer (Base Chest, Monthly Savings, goal chests...).
  // The Debts Chest holds borrowed money, which is not savings.
  const actualSavings = chestsWithBalances
    .filter((c) => c.id !== bufferChest?.id && !(c.isSystem && c.name === DEBTS_CHEST_NAME))
    .reduce((sum, c) => sum + Math.max(c.balance, 0), 0)

  // Money already saved TODAY — any DAILY_SAVING movement dated today, to any chest
  const todaySavingMovement = rawMovements
    .filter((m) => m.reason === 'DAILY_SAVING' && isToday(m.date))
    .reduce<number>((sum, m) => sum + Number(m.amount || 0), 0)

  // The plan pays for 30 days. On the 31st the Buffer and Base Chest pay
  // instead, for as much of a normal day as they can.
  const uncoveredDay = isUncoveredDay(referenceDate)
  const baseChest = chestsWithBalances.find((c) => c.isSystem && c.name === 'Base Chest')
  const reserveBudget = uncoveredDay
    ? uncoveredDayBudget(plannedDailyBudget, (bufferChest?.balance ?? 0) + (baseChest?.balance ?? 0), drawnToday)
    : 0
  const reserveBudgetLeft = Math.max(reserveBudget - drawnToday, 0)

  // On a day the plan covers, money taken from the Buffer to pay for an
  // overspend adds to what the day could afford.
  const coveredToday = uncoveredDay ? 0 : drawnToday
  const dailyBudgetAmount = uncoveredDay ? reserveBudget : plannedDailyBudget + coveredToday

  const dailyRemaining = Math.max(dailyBudgetAmount - dailySpent - todaySavingMovement, 0)
  // What was saved today is committed too, so spending after saving can still
  // put the day over. Without a daily budget there is nothing to be over.
  const dailyOverspend =
    dailyBudgetAmount > 0 ? Math.max(dailySpent + todaySavingMovement - dailyBudgetAmount, 0) : 0

  const exceptionDates = budgetExceptions.map((exception) => new Date(exception.date ?? referenceDate))
  const monthExceptionCount = exceptionDates.filter((date) => date >= startOfPeriod && date <= endOfPeriod).length
  const overspendExplained = exceptionDates.some(
    (date) =>
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate(),
  )
  const monthlyRemaining = periodBudget - monthlySpent
  const monthlyOverspend = Math.max(monthlySpent - periodBudget, 0)

  const allocationBreakdown = allocations.map((allocation) => ({
    id: String(allocation.id),
    name: allocation.name,
    amount: Number(allocation.amount || 0),
    category: allocation.category,
    period: allocation.period,
  }))

  // --- Goals: evaluate each one, from what is already loaded ---
  const monthExceptionAmounts = budgetExceptions
    .filter((exception) => {
      const date = new Date(exception.date ?? referenceDate)
      return date >= startOfPeriod && date <= endOfPeriod
    })
    .map((exception) => Math.max(Number(exception.difference || 0), 0))

  const goalResults = goals.map((goal) => {
    const result = evaluateGoal(goal, { movements, monthExceptionAmounts })
    const goalDebts = debts.filter((debt) => debt.goalId === goal.id && debt.direction === 'BORROWED')

    return {
      id: goal.id,
      name: goal.name,
      satisfied: result.satisfied,
      borrowed: goalDebts.reduce((sum, debt) => sum + Number(debt.principal), 0),
      owed: goalDebts.reduce(
        (sum, debt) =>
          sum +
          debtOutstanding(
            debtTotal(Number(debt.principal), debt.interestType, Number(debt.interestValue)),
            debt.payments.map((payment) => Number(payment.amount)),
          ),
        0,
      ),
      conditionResults: result.conditionResults.map((r) => ({
        measurement: r.condition.measurement,
        operator: String(r.condition.operator),
        target: Number(r.condition.targetValue),
        actual: r.actual,
        satisfied: r.satisfied,
      })),
    }
  })

  return {
    incomeTotal,
    allocationTotal,
    dailyLivingAllocation,
    expenseTotal,
    remaining: dailyRemaining,
    dailyBudget: dailyBudgetAmount,
    periodBudget,
    dailySpent,
    dailyRemaining,
    dailyOverspend,
    monthlySpent,
    monthlyRemaining,
    monthlyOverspend,
    // What is still in the reserves is already saved, so it cannot be saved again.
    dailySaving: Math.max(dailyRemaining - reserveBudgetLeft, 0),
    savedToday: todaySavingMovement,
    uncoveredDay,
    reserveBudgetLeft,
    coveredToday,
    incomes: incomes.map((income) => ({
      id: String(income.id),
      source: String(income.source ?? ''),
      amount: Number(income.amount || 0),
      payDay: Number(income.payDay ?? 1),
    })),
    overspending: dailyOverspend,
    actualSavings,
    buffer,
    totalSaved: actualSavings + buffer,
    exceptionCount: monthExceptionCount,
    overspendExplained,
    dailyExpenses,
    allocationBreakdown,
    chests: chestsWithBalances,
    goals: goalResults,
  }
}