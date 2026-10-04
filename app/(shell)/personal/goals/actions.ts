'use server'

import { revalidatePath } from 'next/cache'

import { abandonGoal, addGoalTask, addMilestone, createPersonalGoal, logGoalValue } from '@/application/personal/goals'
import { addDays, startOfDay } from '@/domain/personal/tasks'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUsePersonal } from '../access'
import { abandonForm, goalForm, goalTaskForm, milestoneForm, valueForm } from './schema'

// Runs a goal form for a person allowed into Personal, on their clock.
async function submit(run: (userId: string) => Promise<FormState>): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return signedOutState(t)
  }

  const state = await run(user.id)

  if (state.status === 'success') {
    revalidatePath('/personal', 'layout')
  }

  return translateFormState(state, t)
}

export async function createGoalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return submit((userId) =>
    goalForm.submit(formData, async (goal) => {
      await createPersonalGoal(
        userId,
        {
          preset: goal.preset,
          name: goal.name,
          horizon: goal.horizon,
          deadline: goal.deadline,
          categoryId: goal.categoryId || null,
          seriesId: goal.seriesId && goal.seriesId !== 'new' ? goal.seriesId : null,
          newSeries: goal.seriesId === 'new' ? { label: goal.seriesLabel ?? '', unit: goal.seriesUnit || null } : null,
          currentValue: goal.currentValue,
          target: goal.target,
          milestones: (goal.milestones ?? '').split('\n'),
          counts: goal.counts,
          floor: goal.floor,
          stretch: goal.stretch,
          weeklySessions: goal.weeklySessions,
        },
        now(),
      )
    }),
  )
}

export async function abandonGoalAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return submit((userId) =>
    abandonForm.submit(formData, ({ goalId, reason }) => abandonGoal(userId, goalId, reason ?? null, now())),
  )
}

export async function addMilestoneAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return submit((userId) => milestoneForm.submit(formData, ({ goalId, name }) => addMilestone(userId, goalId, name)))
}

export async function addGoalTaskAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return submit((userId) =>
    goalTaskForm.submit(formData, async (task) => {
      const today = startOfDay(now())
      await addGoalTask(userId, task.goalId, {
        title: task.title,
        dueDate: task.when === 'inbox' ? null : task.when === 'tomorrow' ? addDays(today, 1) : today,
        recurrence: null,
        categoryId: null,
        milestoneId: task.milestoneId || null,
      })
    }),
  )
}

export async function logValueAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return submit((userId) => valueForm.submit(formData, ({ goalId, value }) => logGoalValue(userId, goalId, value, now())))
}
