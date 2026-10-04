import { redirect } from 'next/navigation'

import { hasSetupPlan } from '@/application/finance/createSetupPlan'
import { getSessionUserId } from '@/infrastructure/auth/sessionUser'

import { SetupForm } from './setup-form'

export default async function FinanceSetupPage() {
  const userId = await getSessionUserId()

  if (!userId) {
    redirect('/login')
  }

  // Setup runs once. Afterwards the plan evolves from the finance pages.
  if (await hasSetupPlan(userId)) {
    redirect('/finance')
  }

  return <SetupForm />
}
