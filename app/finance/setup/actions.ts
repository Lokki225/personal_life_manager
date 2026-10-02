'use server'

import { redirect } from 'next/navigation'

import { createSetupPlan } from '@/application/finance/createSetupPlan'
import { ensureDefaultChests } from '@/application/finance/ensureDefaultChests'
import { resolveSessionUserId } from '@/infrastructure/auth/sessionUser'
import { translateFormState, type FormState } from '@/lib/forms/formState'
import { getT } from '@/lib/i18n/server'

import { setupForm } from './schema'

export async function saveSetupPlan(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await resolveSessionUserId()

  const state = await setupForm.submit(formData, async (plan) => {
    await createSetupPlan(userId, plan)
    // Every account needs its Base Chest and Buffer from day one.
    await ensureDefaultChests(userId)
  })

  if (state.status !== 'success') {
    return translateFormState(state, await getT())
  }

  redirect('/finance')
}
