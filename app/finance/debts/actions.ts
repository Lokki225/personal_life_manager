'use server'

import { revalidatePath } from 'next/cache'

import { recordDebt, repayDebt } from '@/application/finance/debts'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import type { FormState } from '@/lib/forms/formState'

import { debtForm, repayForm } from './schema'

const SIGNED_OUT: FormState = {
  status: 'error',
  fieldErrors: {},
  formErrors: ['Your session has ended. Sign in again to continue.'],
}

export async function createDebtAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
  }

  const state = await debtForm.submit(formData, (debt) =>
    recordDebt({
      userId,
      direction: debt.direction,
      counterparty: debt.counterparty,
      amount: debt.amount,
      interestType: debt.interestType,
      interestValue: debt.interestValue ? Number(debt.interestValue) : null,
      chestId: debt.chestId || null,
      goalId: debt.goalId || null,
      // End of the chosen day, so the debt is not late during that date.
      dueDate: debt.dueDate ? new Date(`${debt.dueDate}T23:59:59`) : null,
    }),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return state
}

export async function repayDebtAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
  }

  const state = await repayForm.submit(formData, (repayment) =>
    repayDebt({ userId, debtId: repayment.debtId, amount: repayment.amount, chestId: repayment.chestId || null }),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return state
}
