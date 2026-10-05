'use server'

import { revalidatePath } from 'next/cache'

import {
  addTask,
  deleteTask,
  dropTask,
  scheduleTask,
  setCarryReason,
  setDailyCapacity,
  setTaskDone,
} from '@/application/personal/tasks'
import { isPersonalRuleError } from '@/domain/personal/errors'
import { addDays, startOfDay } from '@/domain/personal/tasks'
import { TOO_MANY_WRITES, writesAllowed } from '@/infrastructure/auth/limits'
import { getSignedInUser } from '@/infrastructure/auth/sessionUser'
import { now, setClockZone } from '@/lib/clock'
import { signedOutState, translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { canUsePersonal } from '../access'
import { capacityForm, dueDateFrom, recurrenceFrom, taskForm } from './schema'

const refresh = () => revalidatePath('/personal', 'layout')

export async function addTaskAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  // Days are counted on this person's clock from here on.
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return signedOutState(t)
  }

  if (!(await writesAllowed(user.id))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }
  }

  const state = await taskForm.submit(formData, async (task) => {
    await addTask(user.id, {
      title: task.title,
      dueDate: dueDateFrom(task, startOfDay(now())),
      recurrence: recurrenceFrom(task),
      categoryId: task.categoryId || null,
    })
  })

  if (state.status === 'success') {
    refresh()
  }

  return translateFormState(state, t)
}

export async function capacityAction(_previousState: FormState, formData: FormData): Promise<FormState> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return signedOutState(t)
  }

  if (!(await writesAllowed(user.id))) {
    return { status: 'error', fieldErrors: {}, formErrors: [t(TOO_MANY_WRITES)] }
  }

  const state = await capacityForm.submit(formData, ({ capacity }) => setDailyCapacity(user.id, capacity))

  if (state.status === 'success') {
    refresh()
  }

  return translateFormState(state, t)
}

// The one-tap actions below return an error message to show, or null.
type Outcome = { error: string | null }

async function run(task: (userId: string) => Promise<void>): Promise<Outcome> {
  const [user, t] = await Promise.all([getSignedInUser(), getT()])
  setClockZone(user?.timeZone)

  if (!canUsePersonal(user)) {
    return { error: t('Your session has ended. Sign in again to continue.') }
  }

  if (!(await writesAllowed(user.id))) {
    return { error: t(TOO_MANY_WRITES) }
  }

  try {
    await task(user.id)
  } catch (error) {
    if (isPersonalRuleError(error)) {
      return { error: t(error.message) }
    }
    throw error
  }

  refresh()
  return { error: null }
}

export async function toggleTaskAction(taskId: string, done: boolean): Promise<Outcome> {
  return run((userId) => setTaskDone(userId, taskId, done, now()))
}

export async function carryReasonAction(taskId: string, reason: string): Promise<Outcome> {
  return run((userId) => setCarryReason(userId, taskId, reason))
}

export async function scheduleTaskAction(taskId: string, when: 'today' | 'tomorrow' | 'inbox'): Promise<Outcome> {
  return run((userId) => {
    const today = startOfDay(now())
    return scheduleTask(userId, taskId, when === 'inbox' ? null : when === 'tomorrow' ? addDays(today, 1) : today)
  })
}

export async function dropTaskAction(taskId: string): Promise<Outcome> {
  return run((userId) => dropTask(userId, taskId))
}

export async function deleteTaskAction(taskId: string): Promise<Outcome> {
  return run((userId) => deleteTask(userId, taskId))
}
