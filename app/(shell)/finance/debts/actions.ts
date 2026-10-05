'use server'

import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { recordDebt, repayDebt } from '@/application/finance/debts'
import { notifyReachedGoals } from '@/application/notifications/instant'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { debtForm, repayForm } from './schema'

export async function createDebtAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  if (!(await writesAllowed(userId))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }
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
    notifyLater(() => notifyReachedGoals(userId))
  }

  return translateFormState(state, t)
}

export async function repayDebtAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  if (!(await writesAllowed(userId))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }
  }

  const state = await repayForm.submit(formData, (repayment) =>
    repayDebt({ userId, debtId: repayment.debtId, amount: repayment.amount, chestId: repayment.chestId || null }),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
    notifyLater(() => notifyReachedGoals(userId))
  }

  return translateFormState(state, t)
}
