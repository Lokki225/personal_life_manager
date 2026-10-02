'use server'

import { revalidatePath } from 'next/cache'

import { MovementReason } from '@/app/generated/prisma/enums'
import { consolidateBuffer } from '@/application/finance/consolidateBuffer'
import { confirmIncome } from '@/application/finance/confirmIncome'
import { removeAllocation, saveAllocation } from '@/application/finance/managePlan'
import { recordDailyException } from '@/application/finance/recordDailyException'
import { recordDailyExpense } from '@/application/finance/recordDailyExpense'
import { saveDailyRemaining } from '@/application/finance/saveDailyRemaining'
import { transferBetweenChests } from '@/application/finance/transferBetweenChests'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import {
  confirmIncomeForm,
  deleteAllocationForm,
  planAllocationForm,
  consolidateForm,
  exceptionForm,
  expenseForm,
  saveRemainingForm,
  transferForm,
} from './schema'

function refreshFinance() {
  revalidatePath('/finance', 'layout')
}

export async function addExpense(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await expenseForm.submit(formData, (expense) =>
    recordDailyExpense({
      userId,
      amount: expense.amount,
      category: expense.category,
      description: expense.description || null,
    }),
  )

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function confirmIncomeAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await confirmIncomeForm.submit(formData, (income) =>
    confirmIncome({ userId, incomeId: income.incomeId, amount: income.amount }),
  )

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function saveRemaining(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await saveRemainingForm.submit(formData, (saving) =>
    saveDailyRemaining({
      userId,
      amount: saving.amount,
      destinationChestId: saving.destinationChestId || null,
    }),
  )

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function recordException(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await exceptionForm.submit(formData, (exception) =>
    recordDailyException({ userId, category: exception.category, reason: exception.reason }),
  )

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function transferChests(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await transferForm.submit(formData, (transfer) =>
    transferBetweenChests(
      userId,
      transfer.sourceChestId,
      transfer.destinationChestId,
      transfer.amount,
      MovementReason.WITHDRAWAL,
    ),
  )

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function consolidateBufferAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await consolidateForm.submit(formData, async () => {
    await consolidateBuffer(userId)
  })

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function saveAllocationAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await planAllocationForm.submit(formData, (allocation) => saveAllocation(userId, allocation))

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}

export async function deleteAllocationAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await deleteAllocationForm.submit(formData, ({ id }) => removeAllocation(userId, id))

  if (state.status === 'success') {
    refreshFinance()
  }

  return translateFormState(state, t)
}
