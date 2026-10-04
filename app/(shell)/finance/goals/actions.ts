'use server'

import { revalidatePath } from 'next/cache'

import { notifyLater } from '@/app/notify-later'
import { createCustomGoal } from '@/application/finance/createCustomGoal'
import { createSavingsGoal } from '@/application/finance/createSavingsGoal'
import { fundGoal } from '@/application/finance/fundGoal'
import { notifyReachedGoals } from '@/application/notifications/instant'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { customGoalForm, fundGoalForm, goalForm } from './schema'

export async function createGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

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
    notifyLater(() => notifyReachedGoals(userId))
  }

  return translateFormState(state, t)
}

export async function fundGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await fundGoalForm.submit(formData, (funding) =>
    fundGoal(userId, funding.goalId, funding.amount, funding.sourceChestId),
  )

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
    notifyLater(() => notifyReachedGoals(userId))
  }

  return translateFormState(state, t)
}

export async function createCustomGoalAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  const userId = user?.id
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!userId) {
    return signedOutState(t)
  }

  const state = await customGoalForm.submit(formData, async (goal) => {
    await createCustomGoal(userId, goal)
  })

  if (state.status === 'success') {
    revalidatePath('/finance', 'layout')
    notifyLater(() => notifyReachedGoals(userId))
  }

  return translateFormState(state, t)
}
