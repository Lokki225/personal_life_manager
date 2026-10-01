'use server'

import { revalidatePath } from 'next/cache'

import { createSavingsGoal } from '@/application/finance/createSavingsGoal'
import { fundGoal } from '@/application/finance/fundGoal'
import { getSignedInUserId } from '@/infrastructure/auth/sessionUser'
import type { FormState } from '@/lib/forms/formState'

import { fundGoalForm, goalForm } from './schema'

const SIGNED_OUT: FormState = {
  status: 'error',
  fieldErrors: {},
  formErrors: ['Your session has ended. Sign in again to continue.'],
}

export async function createGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
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

  return state
}

export async function fundGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await getSignedInUserId()

  if (!userId) {
    return SIGNED_OUT
  }

  const state = await fundGoalForm.submit(formData, (funding) =>
    fundGoal(userId, funding.goalId, funding.amount, funding.sourceChestId),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
  }

  return state
}
