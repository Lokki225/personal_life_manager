'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createFinancialGoal } from '@/application/finance/createFinancialGoal'
import { fundGoal } from '@/application/finance/fundGoal'
import { prisma } from '@/infrastructure/prisma/client'

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const directUserId =
    session?.user && 'id' in session.user ? String(session.user.id) : null

  if (directUserId) {
    return directUserId
  }

  const email = session?.user?.email ? String(session.user.email).toLowerCase() : null
  if (!email) {
    return null
  }

  const user = await prisma.user.findUnique({ where: { email } })
  return user ? user.id : null
}

export async function createGoalAction(formData: FormData): Promise<void> {
  const userId = await resolveUserId()
  if (!userId) {
    throw new Error('You must be signed in to create a goal.')
  }

  const name = String(formData.get('name') ?? '').trim()
  const targetAmount = Number(formData.get('targetAmount') ?? 0)
  const currentAmount = Number(formData.get('currentAmount') ?? 0)

  if (!name || targetAmount <= 0) {
    throw new Error('A goal name and a target amount greater than zero are required.')
  }

  await createFinancialGoal({
    userId,
    name,
    targetAmount,
    currentAmount,
  })

  revalidatePath('/finance')
  revalidatePath('/finance/goals')
}

export async function fundGoalAction(formData: FormData): Promise<void> {
  const userId = await resolveUserId()
  if (!userId) {
    throw new Error('You must be signed in to fund a goal.')
  }

  const goalId = String(formData.get('goalId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)

  if (!goalId || amount <= 0) {
    throw new Error('A goal and a positive amount are required.')
  }

  await fundGoal({
    userId,
    goalId,
    amount,
  })

  revalidatePath('/finance')
  revalidatePath('/finance/goals')
}
