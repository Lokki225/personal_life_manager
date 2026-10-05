'use server'

import { revalidatePath } from 'next/cache'

import { MovementReason } from '@/app/generated/prisma/enums'
import { notifyLater } from '@/app/notify-later'
import { confirmIncome } from '@/application/finance/confirmIncome'
import { consolidateBuffer } from '@/application/finance/consolidateBuffer'
import { coverOverspend } from '@/application/finance/coverOverspend'
import { editExpense, removeExpense } from '@/application/finance/manageExpense'
import { removeAllocation, removeIncome, saveAllocation, saveIncome } from '@/application/finance/managePlan'
import { syncPlanToChests } from '@/application/finance/syncPlanToChests'
import { transferBetweenChests } from '@/application/finance/transferBetweenChests'
import { notifyReachedGoals } from '@/application/notifications/instant'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import {
  confirmIncomeForm,
  coverForm,
  deleteAllocationForm,
  deleteExpenseForm,
  deleteIncomeForm,
  editExpenseForm,
  incomeForm,
  planAllocationForm,
  consolidateForm,
  transferForm,
} from './schema'

// After money moved: the pages show it, and a goal it completed is told.
function refreshFinance(userId: string) {
  revalidatePath('/finance', 'layout')
  notifyLater(() => notifyReachedGoals(userId))
}

export async function confirmIncomeAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await confirmIncomeForm.submit(formData, (income) =>
    confirmIncome({ userId, incomeId: income.incomeId, amount: income.amount }),
  )

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function transferChests(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

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
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function consolidateBufferAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await consolidateForm.submit(formData, async () => {
    await consolidateBuffer(userId)
  })

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function saveAllocationAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await planAllocationForm.submit(formData, async (allocation) => {
    await saveAllocation(userId, allocation)
    // The chests follow the plan: a new allocation takes its money from the Base Chest.
    await syncPlanToChests(userId)
  })

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function deleteAllocationAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await deleteAllocationForm.submit(formData, async ({ id }) => {
    await removeAllocation(userId, id)
    await syncPlanToChests(userId)
  })

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function editExpenseAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await editExpenseForm.submit(formData, (expense) =>
    editExpense(userId, { ...expense, description: expense.description || null }),
  )

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function deleteExpenseAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await deleteExpenseForm.submit(formData, ({ id }) => removeExpense(userId, id))

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function saveIncomeAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await incomeForm.submit(formData, (income) => saveIncome(userId, income))

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function coverOverspendAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await coverForm.submit(formData, async () => {
    await coverOverspend(userId)
  })

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}

export async function deleteIncomeAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await deleteIncomeForm.submit(formData, ({ id }) => removeIncome(userId, id))

  if (state.status === 'success') {
    refreshFinance(userId)
  }

  return translateFormState(state, t)
}
