'use server'

import { revalidatePath } from 'next/cache'

import { createCustomGoal } from '@/application/finance/createCustomGoal'
import { createSavingsGoal } from '@/application/finance/createSavingsGoal'
import { fundGoal } from '@/application/finance/fundGoal'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { customGoalForm, fundGoalForm, goalForm } from './schema'

export async function createGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await goalForm.submit(formData, async (goal) => {
    await createSavingsGoal(userId, {
      name: goal.name,
      targetAmount: goal.targetAmount,
      alreadySaved: goal.alreadySaved,
    })
  })

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return translateFormState(state, t)
}

export async function fundGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await fundGoalForm.submit(formData, (funding) =>
    fundGoal(userId, funding.goalId, funding.amount, funding.sourceChestId),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return translateFormState(state, t)
}

export async function createCustomGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [userId, t] = await Promise.all([getSignedInUserId(), getT()])

  if (!userId) {
    return signedOutState(t)
  }

  const state = await customGoalForm.submit(formData, async (goal) => {
    await createCustomGoal(userId, goal)
  })

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return translateFormState(state, t)
}
