'use server'

import { redirect } from 'next/navigation'

import { depositSetupMonth } from '@/application/finance/confirmIncome'
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
    // This month's income is already in hand: its savings and what no
    // allocation claims go into the chests now.
    await depositSetupMonth(userId)
  })

  if (state.status !== 'success') {
    return translateFormState(state, await getT())
  }

  redirect('/finance')
}
