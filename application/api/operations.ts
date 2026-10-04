import { z } from 'zod'

import { MovementReason } from '@/app/generated/prisma/enums'
import {
  ALLOCATION_CATEGORIES,
  ALLOCATION_PERIODS,
  DEBT_DIRECTIONS,
  EXCEPTION_CATEGORIES,
  EXPENSE_CATEGORIES,
  INTEREST_TYPES,
} from '@/domain/finance/options'


import { pushRepository } from '@/infrastructure/repositories/pushRepository'
import { userRepository } from '@/infrastructure/repositories/userRepository'
import { now } from '@/lib/clock'
import { fullName, shortName } from '@/lib/greeting'
import { m } from '@/lib/i18n/translate'

import { confirmIncome, listPendingIncomes } from '../finance/confirmIncome'
import { coverOverspend } from '../finance/coverOverspend'
import { createChest } from '../finance/createChest'
import { createCustomGoal } from '../finance/createCustomGoal'
import { createSavingsGoal } from '../finance/createSavingsGoal'
import { listDebtsWithStatus, recordDebt, repayDebt } from '../finance/debts'
import { deleteChest } from '../finance/deleteChest'
import { fundGoal } from '../finance/fundGoal'
import { getHistory } from '../finance/getHistory'
import { getReview } from '../finance/getReview'
import { editExpense, removeExpense } from '../finance/manageExpense'
import { removeAllocation, removeIncome, saveAllocation, saveIncome } from '../finance/managePlan'
import { GOAL_MEASUREMENTS } from '../finance/measurements'
import { recomputeFinanceState } from '../finance/recomputeFinanceState'
import { recordDailyException } from '../finance/recordDailyException'
import { recordDailyExpense } from '../finance/recordDailyExpense'
import { saveDailyRemaining } from '../finance/saveDailyRemaining'
import { settleDays } from '../finance/settleDays'
import { syncPlanToChests } from '../finance/syncPlanToChests'
import { transferBetweenChests } from '../finance/transferBetweenChests'
import { notifyDevices } from '../notifications/notify'
import {
  amountField,
  ApiNotFound,
  dayField,
  endOfDay,
  idField,
  noInput,
  operation,
  payDayField,
  periodField,
  text,
  type ApiUser,
} from './operation'
import { chestsView, debtsView, goalsView, historyView, planView, reviewView, todayView } from './views'

// What the finance operations start from. As on the pages, the days that ended
// since the last visit are closed first, so the figures are the same ones the
// person sees in the app.
async function financeState(user: ApiUser) {
  await settleDays(user)

  const today = now()
  const [state, pendingIncomes] = await Promise.all([
    recomputeFinanceState({ userId: user.id, referenceDate: today }),
    listPendingIncomes(user.id, today),
  ])

  return { state, pendingIncomes, today }
}

// Each kind of change answers with the part of the app it changed.
const today = async (user: ApiUser) => {
  const { state, pendingIncomes, today } = await financeState(user)

  return todayView(state, pendingIncomes, today)
}
const plan = async (user: ApiUser) => planView((await financeState(user)).state)
const chests = async (user: ApiUser) => chestsView((await financeState(user)).state)
const goals = async (user: ApiUser) => goalsView((await financeState(user)).state)
const debts = async (user: ApiUser) => debtsView(await listDebtsWithStatus(user.id))

const expenseCategory = z.enum(EXPENSE_CATEGORIES, {
  error: `Use one of these for "category": ${EXPENSE_CATEGORIES.join(', ')}.`,
})
const overspendCause = z.enum(EXCEPTION_CATEGORIES, {
  error: `Use one of these for "cause": ${EXCEPTION_CATEGORIES.join(', ')}.`,
})
const allocationCategory = z.enum(ALLOCATION_CATEGORIES, {
  error: `Use one of these for "category": ${ALLOCATION_CATEGORIES.join(', ')}.`,
})
const allocationPeriod = z.enum(ALLOCATION_PERIODS, { error: 'Use "monthly" or "weekly" for the period.' })
const description = z.string().trim().max(80, 'Keep the description under 80 characters.')
const reason = z.string().trim().max(160, 'Keep the reason under 160 characters.')
const chestId = z.string().trim().min(1)

const NOT_TODAY = 'No expense of today has this id. Only expenses of today can be changed.'

const someOf = (names: string) => `Give at least one of ${names}.`
const hasChange = (change: Record<string, unknown>) =>
  Object.entries(change).some(([key, value]) => key !== 'id' && value !== undefined)

export const operations = {
  // --- Read ------------------------------------------------------------------

  getMe: operation({
    name: 'get_me',
    method: 'GET',
    path: '/me',
    needs: 'READ',
    does: 'Who the person is: name, language, time zone, and the weekday their Buffer is emptied.',
    input: noInput,
    run: async (user) => ({
      id: user.id,
      name: fullName(user),
      // The name to greet the person with.
      callName: shortName(user),
      email: user.email,
      // The language to write to them in: 'fr', 'en', or null when unknown.
      language: user.locale,
      timeZone: user.timeZone,
      // The weekday the Buffer goes to the Base Chest: 0 is Sunday, 6 Saturday.
      bufferTransferDay: user.bufferSweepDay,
    }),
  }),

  getToday: operation({
    name: 'get_today',
    method: 'GET',
    path: '/finance/today',
    needs: 'READ',
    does: 'Today: the budget, what was spent and saved, what is left, the expenses, and incomes waiting to be confirmed.',
    input: noInput,
    run: today,
  }),

  getPlan: operation({
    name: 'get_plan',
    method: 'GET',
    path: '/finance/plan',
    needs: 'READ',
    does: 'The plan: incomes, allocations, what is unallocated, and the daily budget they give.',
    input: noInput,
    run: plan,
  }),

  getChests: operation({
    name: 'get_chests',
    method: 'GET',
    path: '/finance/chests',
    needs: 'READ',
    does: 'The chests (Base Chest, Buffer, Debts Chest and the person’s own) with their balances.',
    input: noInput,
    run: chests,
  }),

  getGoals: operation({
    name: 'get_goals',
    method: 'GET',
    path: '/finance/goals',
    needs: 'READ',
    does: 'The goals, their conditions and how far each one is.',
    input: noInput,
    run: goals,
  }),

  getDebts: operation({
    name: 'get_debts',
    method: 'GET',
    path: '/finance/debts',
    needs: 'READ',
    does: 'Money borrowed and money lent, with what is still outstanding.',
    input: noInput,
    run: debts,
  }),

  getHistory: operation({
    name: 'get_history',
    method: 'GET',
    path: '/finance/history',
    needs: 'READ',
    does: 'What was recorded over a period, newest first: expenses, exceptions and movements between chests.',
    input: z.object({
      period: periodField.default('month'),
      type: z
        .enum(['all', 'expense', 'exception', 'movement'], {
          error: 'Use "all", "expense", "exception" or "movement" for the type.',
        })
        .default('all'),
      category: z.string().trim().max(40).optional(),
    }),
    run: async (user, { period, type, category }) => {
      await settleDays(user)

      return historyView(await getHistory({ userId: user.id, period, type, category: category || 'all' }))
    },
  }),

  getReview: operation({
    name: 'get_review',
    method: 'GET',
    path: '/finance/review',
    needs: 'READ',
    does: 'Planned against actual over a period: spending and overspend by category, savings, and the trend.',
    input: z.object({ period: periodField.default('month') }),
    run: async (user, { period }) => {
      await settleDays(user)

      return reviewView(await getReview({ userId: user.id, period }))
    },
  }),

  // --- Today -----------------------------------------------------------------

  recordExpense: operation({
    name: 'record_expense',
    method: 'POST',
    path: '/finance/expenses',
    needs: 'WRITE',
    does: 'Records an expense made today. By default today\'s budget pays: when it is more than what is left, it becomes an exception, so give its "cause". With "chestId", that chest pays at once instead and the day is left alone (for example a purchase saved for in a goal\'s chest).',
    status: 201,
    input: z.object({
      amount: amountField,
      category: expenseCategory,
      description: description.optional(),
      // Only used when the expense goes beyond what is left today: why it did.
      cause: overspendCause.optional(),
      reason: reason.optional(),
      // The chest that pays for it instead of today's budget.
      chestId: chestId.optional(),
    }),
    run: async (user, expense) => {
      // Closes the days that ended first, so the expense lands on a settled day.
      await settleDays(user)
      await recordDailyExpense({
        userId: user.id,
        amount: expense.amount,
        category: expense.category,
        description: expense.description || null,
        cause: expense.cause ?? null,
        reason: expense.reason || null,
        chestId: expense.chestId ?? null,
      })

      return today(user)
    },
  }),

  editExpense: operation({
    name: 'edit_expense',
    method: 'PATCH',
    path: '/finance/expenses/{id}',
    needs: 'WRITE',
    does: 'Corrects one of the expenses of today. What is left out stays as it was.',
    input: z
      .object({
        id: idField,
        amount: amountField.optional(),
        category: expenseCategory.optional(),
        description: description.nullable().optional(),
      })
      .refine(hasChange, { error: someOf('"amount", "category" or "description"') }),
    run: async (user, change) => {
      const current = (await financeState(user)).state.dailyExpenses.find((expense) => expense.id === change.id)

      if (!current) {
        throw new ApiNotFound(NOT_TODAY)
      }

      await editExpense(user.id, {
        id: change.id,
        amount: change.amount ?? current.amount,
        category: change.category ?? current.category,
        description: change.description === undefined ? current.description : change.description,
      })

      return today(user)
    },
  }),

  deleteExpense: operation({
    name: 'delete_expense',
    method: 'DELETE',
    path: '/finance/expenses/{id}',
    needs: 'WRITE',
    does: 'Deletes one of the expenses of today.',
    input: z.object({ id: idField }),
    run: async (user, { id }) => {
      if (!(await financeState(user)).state.dailyExpenses.some((expense) => expense.id === id)) {
        throw new ApiNotFound(NOT_TODAY)
      }

      await removeExpense(user.id, id)

      return today(user)
    },
  }),

  saveToday: operation({
    name: 'save_from_today',
    method: 'POST',
    path: '/finance/savings',
    needs: 'WRITE',
    does: 'Puts part of what is left of the budget of today into a chest: the Buffer unless "chestId" is given.',
    status: 201,
    input: z.object({ amount: amountField, chestId: chestId.optional() }),
    run: async (user, saving) => {
      await settleDays(user)
      await saveDailyRemaining({ userId: user.id, amount: saving.amount, destinationChestId: saving.chestId ?? null })

      return today(user)
    },
  }),

  explainOverspend: operation({
    name: 'explain_overspend',
    method: 'POST',
    path: '/finance/today/exception',
    needs: 'WRITE',
    does: 'Says why today went over budget, when it did and is not explained yet.',
    status: 201,
    input: z.object({ cause: overspendCause, reason: reason.optional() }),
    run: async (user, exception) => {
      await settleDays(user)
      await recordDailyException({ userId: user.id, category: exception.cause, reason: exception.reason || null })

      return today(user)
    },
  }),

  coverOverspend: operation({
    name: 'cover_overspend',
    method: 'POST',
    path: '/finance/today/cover',
    needs: 'WRITE',
    does: 'Pays for the overspend of today out of the Buffer, as far as the Buffer goes.',
    status: 201,
    input: noInput,
    run: async (user) => {
      await settleDays(user)
      await coverOverspend(user.id)

      return today(user)
    },
  }),

  // --- Plan ------------------------------------------------------------------

  addIncome: operation({
    name: 'add_income',
    method: 'POST',
    path: '/finance/incomes',
    needs: 'WRITE',
    does: 'Adds a monthly income to the plan.',
    status: 201,
    input: z.object({ source: text('source', 60), amount: amountField, payDay: payDayField }),
    run: async (user, income) => {
      await saveIncome(user.id, income)

      return plan(user)
    },
  }),

  editIncome: operation({
    name: 'edit_income',
    method: 'PATCH',
    path: '/finance/incomes/{id}',
    needs: 'WRITE',
    does: 'Changes an income of the plan. What is left out stays as it was.',
    input: z
      .object({
        id: idField,
        source: text('source', 60).optional(),
        amount: amountField.optional(),
        payDay: payDayField.optional(),
      })
      .refine(hasChange, { error: someOf('"source", "amount" or "payDay"') }),
    run: async (user, change) => {
      const current = (await financeState(user)).state.incomes.find((income) => income.id === change.id)

      if (!current) {
        throw new ApiNotFound('No income has this id.')
      }

      await saveIncome(user.id, {
        id: change.id,
        source: change.source ?? current.source,
        amount: change.amount ?? current.amount,
        payDay: change.payDay ?? current.payDay,
      })

      return plan(user)
    },
  }),

  deleteIncome: operation({
    name: 'delete_income',
    method: 'DELETE',
    path: '/finance/incomes/{id}',
    needs: 'WRITE',
    does: 'Removes an income from the plan. The plan keeps at least one.',
    input: z.object({ id: idField }),
    run: async (user, { id }) => {
      await removeIncome(user.id, id)

      return plan(user)
    },
  }),

  confirmIncome: operation({
    name: 'confirm_income',
    method: 'POST',
    path: '/finance/incomes/{id}/confirm',
    needs: 'WRITE',
    does: 'Confirms that an income arrived this month, so its money goes into the chests. Without "amount", the usual amount is used.',
    status: 201,
    input: z.object({ id: idField, amount: amountField.optional() }),
    run: async (user, { id, amount }) => {
      const { pendingIncomes } = await financeState(user)
      const usual = pendingIncomes.find((income) => income.id === id)?.usualAmount

      if (amount === undefined && usual === undefined) {
        throw new ApiNotFound('No income waiting to be confirmed has this id.')
      }

      await confirmIncome({ userId: user.id, incomeId: id, amount: amount ?? usual! })

      return today(user)
    },
  }),

  addAllocation: operation({
    name: 'add_allocation',
    method: 'POST',
    path: '/finance/allocations',
    needs: 'WRITE',
    does: 'Adds an allocation to the plan. "daily_living" feeds the daily budget; "savings" is set aside in a chest.',
    status: 201,
    input: z.object({
      name: text('name', 60),
      amount: amountField,
      period: allocationPeriod.default('monthly'),
      category: allocationCategory,
    }),
    run: async (user, allocation) => {
      await saveAllocation(user.id, allocation)
      // The chests follow the plan: a new allocation takes its money from the Base Chest.
      await syncPlanToChests(user.id)

      return plan(user)
    },
  }),

  editAllocation: operation({
    name: 'edit_allocation',
    method: 'PATCH',
    path: '/finance/allocations/{id}',
    needs: 'WRITE',
    does: 'Changes an allocation of the plan. What is left out stays as it was.',
    input: z
      .object({
        id: idField,
        name: text('name', 60).optional(),
        amount: amountField.optional(),
        period: allocationPeriod.optional(),
        category: allocationCategory.optional(),
      })
      .refine(hasChange, { error: someOf('"name", "amount", "period" or "category"') }),
    run: async (user, change) => {
      const current = (await financeState(user)).state.allocationBreakdown.find(
        (allocation) => allocation.id === change.id,
      )

      if (!current) {
        throw new ApiNotFound('No allocation has this id.')
      }

      await saveAllocation(user.id, {
        id: change.id,
        name: change.name ?? current.name,
        amount: change.amount ?? current.amount,
        period: change.period ?? current.period,
        category: change.category ?? current.category,
      })
      await syncPlanToChests(user.id)

      return plan(user)
    },
  }),

  deleteAllocation: operation({
    name: 'delete_allocation',
    method: 'DELETE',
    path: '/finance/allocations/{id}',
    needs: 'WRITE',
    does: 'Removes an allocation from the plan. Its money goes back to the Base Chest.',
    input: z.object({ id: idField }),
    run: async (user, { id }) => {
      await removeAllocation(user.id, id)
      await syncPlanToChests(user.id)

      return plan(user)
    },
  }),

  // --- Chests ----------------------------------------------------------------

  createChest: operation({
    name: 'create_chest',
    method: 'POST',
    path: '/finance/chests',
    needs: 'WRITE',
    does: 'Creates a chest. A "SECURE" chest can be locked until a date: no money leaves it before.',
    status: 201,
    input: z.object({
      name: text('name', 40),
      type: z.enum(['AVAILABLE', 'SECURE'], { error: 'Use "AVAILABLE" or "SECURE" for the type.' }).default('AVAILABLE'),
      lockedUntil: dayField.optional(),
    }),
    run: async (user, chest) => {
      await createChest(user.id, { name: chest.name, type: chest.type, lockedUntil: endOfDay(chest.lockedUntil) })

      return chests(user)
    },
  }),

  deleteChest: operation({
    name: 'delete_chest',
    method: 'DELETE',
    path: '/finance/chests/{id}',
    needs: 'WRITE',
    does: 'Deletes an empty chest of the person’s own that no goal uses.',
    input: z.object({ id: idField }),
    run: async (user, { id }) => {
      await deleteChest(user.id, id)

      return chests(user)
    },
  }),

  transfer: operation({
    name: 'transfer_between_chests',
    method: 'POST',
    path: '/finance/transfers',
    needs: 'WRITE',
    does: 'Moves money from one chest to another.',
    status: 201,
    input: z.object({
      fromChestId: text('fromChestId', 60),
      toChestId: text('toChestId', 60),
      amount: amountField,
    }),
    run: async (user, transfer) => {
      await settleDays(user)
      await transferBetweenChests(
        user.id,
        transfer.fromChestId,
        transfer.toChestId,
        transfer.amount,
        MovementReason.WITHDRAWAL,
      )

      return chests(user)
    },
  }),

  setBufferDay: operation({
    name: 'set_buffer_transfer_day',
    method: 'PATCH',
    path: '/finance/settings',
    needs: 'WRITE',
    does: 'Chooses the weekday the Buffer is emptied into the Base Chest: 0 is Sunday, 6 is Saturday.',
    input: z.object({
      bufferTransferDay: z
        .number({ error: 'Give "bufferTransferDay" from 0 (Sunday) to 6 (Saturday).' })
        .int('Give "bufferTransferDay" from 0 (Sunday) to 6 (Saturday).')
        .min(0, 'Give "bufferTransferDay" from 0 (Sunday) to 6 (Saturday).')
        .max(6, 'Give "bufferTransferDay" from 0 (Sunday) to 6 (Saturday).'),
    }),
    run: async (user, { bufferTransferDay }) => {
      await userRepository.setBufferSweepDay(user.id, bufferTransferDay)

      return { bufferTransferDay }
    },
  }),

  // --- Goals -----------------------------------------------------------------

  createGoal: operation({
    name: 'create_goal',
    method: 'POST',
    path: '/finance/goals',
    needs: 'WRITE',
    does: 'Creates a goal. Give "targetAmount" for a savings goal (it gets its own chest), or "conditions" for a goal built from measurements.',
    status: 201,
    input: z
      .object({
        name: text('name', 40),
        // A savings goal: the amount to reach, and what is already put aside.
        targetAmount: amountField.optional(),
        alreadySaved: z.number().min(0, '"alreadySaved" cannot be negative.').optional(),
        // A custom goal: up to 5 conditions, all or any of which must hold.
        logic: z.enum(['ALL', 'ANY'], { error: 'Use "ALL" or "ANY" for the logic.' }).default('ALL'),
        conditions: z
          .array(
            z.object({
              measurement: z.enum(GOAL_MEASUREMENTS, {
                error: `Use one of these for "measurement": ${Object.values(GOAL_MEASUREMENTS).join(', ')}.`,
              }),
              operator: z.enum(['GTE', 'LTE', 'EQ', 'GT', 'LT'], {
                error: 'Use "GTE", "LTE", "EQ", "GT" or "LT" for the operator.',
              }),
              targetValue: z.number({ error: 'Give "targetValue" as a number.' }).min(0, 'A target cannot be negative.'),
              // Needed when the measurement is "chest_balance".
              chestId: chestId.optional(),
            }),
          )
          .min(1, 'Add at least one condition.')
          .max(5, 'A goal can have up to 5 conditions.')
          .optional(),
      })
      .refine((goal) => goal.targetAmount !== undefined || goal.conditions !== undefined, {
        error: 'Give "targetAmount" for a savings goal, or "conditions" for a custom one.',
      }),
    run: async (user, goal) => {
      if (goal.conditions) {
        await createCustomGoal(user.id, { name: goal.name, logic: goal.logic, conditions: goal.conditions })
      } else {
        await createSavingsGoal(user.id, {
          name: goal.name,
          targetAmount: goal.targetAmount!,
          alreadySaved: goal.alreadySaved,
        })
      }

      return goals(user)
    },
  }),

  fundGoal: operation({
    name: 'fund_goal',
    method: 'POST',
    path: '/finance/goals/{id}/fund',
    needs: 'WRITE',
    does: 'Moves money from a chest into the chest of a savings goal.',
    status: 201,
    input: z.object({ id: idField, amount: amountField, fromChestId: text('fromChestId', 60) }),
    run: async (user, { id, amount, fromChestId }) => {
      await settleDays(user)
      await fundGoal(user.id, id, amount, fromChestId)

      return goals(user)
    },
  }),

  // --- Debts -----------------------------------------------------------------

  recordDebt: operation({
    name: 'record_debt',
    method: 'POST',
    path: '/finance/debts',
    needs: 'WRITE',
    does: 'Records money borrowed (it goes into the Debts Chest) or lent (it leaves the Buffer, Base Chest or Debts Chest given by "chestId").',
    status: 201,
    input: z.object({
      direction: z.enum(DEBT_DIRECTIONS, { error: 'Use "BORROWED" or "LENT" for the direction.' }),
      // Who the money was borrowed from or lent to.
      counterparty: text('counterparty', 60),
      amount: amountField,
      // 'PERCENT' of the amount, or a 'FIXED' sum on top of it.
      interestType: z.enum(INTEREST_TYPES, { error: 'Use "NONE", "PERCENT" or "FIXED" for the interest type.' }).default('NONE'),
      interestValue: z.number().min(0, '"interestValue" cannot be negative.').optional(),
      chestId: chestId.optional(),
      // The goal the money was borrowed for.
      goalId: z.string().trim().min(1).optional(),
      dueDate: dayField.optional(),
    }),
    run: async (user, debt) => {
      await recordDebt({
        userId: user.id,
        direction: debt.direction,
        counterparty: debt.counterparty,
        amount: debt.amount,
        interestType: debt.interestType,
        interestValue: debt.interestValue ?? null,
        chestId: debt.chestId ?? null,
        goalId: debt.goalId ?? null,
        dueDate: endOfDay(debt.dueDate),
      })

      return debts(user)
    },
  }),

  repayDebt: operation({
    name: 'repay_debt',
    method: 'POST',
    path: '/finance/debts/{id}/payments',
    needs: 'WRITE',
    does: 'Records a repayment: of money borrowed (paid from "chestId") or of money lent (it comes back into the Base Chest).',
    status: 201,
    input: z.object({ id: idField, amount: amountField, chestId: chestId.optional() }),
    run: async (user, { id, amount, chestId }) => {
      await repayDebt({ userId: user.id, debtId: id, amount, chestId: chestId ?? null })

      return debts(user)
    },
  }),

  // --- Notifications ---------------------------------------------------------

  notify: operation({
    name: 'send_notification',
    method: 'POST',
    path: '/notifications',
    needs: 'WRITE',
    does: 'Sends a notification to the devices of the person. "delivered" is how many got it; 0 means notifications are off.',
    status: 201,
    input: z.object({
      title: text('title', 80),
      body: text('body', 300),
      // The page of the app to open when it is tapped.
      url: z
        .string()
        .trim()
        .regex(/^\/(?!\/)\S*$/, 'Give "url" as a path inside the app, for example "/finance/review".')
        .max(200)
        .optional(),
    }),
    run: async (user, { title, body, url }) => {
      const devices = await pushRepository.listSubscriptions(user.id)
      const delivered = await notifyDevices(devices, { title, body, url: url ?? '/finance' })

      return { delivered, devices: devices.length }
    },
  }),
}

export const operationList = Object.values(operations)

// What a change made through the API reads like in the notification sent to
// the key's owner, by operation name. {amount} is the amount of the request.
export const DONE: Record<string, string> = {
  record_expense: m('Recorded an expense of {amount}.'),
  edit_expense: m('Changed an expense of today.'),
  delete_expense: m('Deleted an expense of today.'),
  save_from_today: m('Saved {amount} from today.'),
  explain_overspend: m("Explained today's overspend."),
  cover_overspend: m("Covered today's overspend from the Buffer."),
  add_income: m('Added an income.'),
  edit_income: m('Changed an income.'),
  delete_income: m('Removed an income.'),
  confirm_income: m('Confirmed an income.'),
  add_allocation: m('Added an allocation.'),
  edit_allocation: m('Changed an allocation.'),
  delete_allocation: m('Removed an allocation.'),
  create_chest: m('Created a chest.'),
  delete_chest: m('Deleted a chest.'),
  transfer_between_chests: m('Moved {amount} between chests.'),
  set_buffer_transfer_day: m('Changed the day the Buffer is emptied.'),
  create_goal: m('Created a goal.'),
  fund_goal: m('Put {amount} towards a goal.'),
  record_debt: m('Recorded a debt or a loan of {amount}.'),
  repay_debt: m('Recorded a repayment of {amount}.'),
}
