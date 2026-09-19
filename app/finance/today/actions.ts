'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createBudgetException } from '@/application/finance/createBudgetException'
import { recordExpense } from '@/application/finance/recordExpense'
import { recordSaving } from '@/application/finance/recordSaving'
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

export async function addExpense(formData: FormData): Promise<void> {
  const userId = await resolveUserId()

  if (!userId) {
    throw new Error('You must be signed in to record an expense.')
  }

  const amount = Number(formData.get('amount') ?? 0)
  const category = String(formData.get('category') ?? 'other')
  const projectId = String(formData.get('projectId') ?? '').trim() || null
  const description = String(formData.get('description') ?? '').trim() || 'Expense'

  await recordExpense({
    userId,
    amount,
    category,
    date: new Date(),
    projectId,
    description,
  })

  revalidatePath('/finance')
  revalidatePath('/finance/today')
}

export async function saveUnderspend(formData: FormData): Promise<void> {
  const userId = await resolveUserId()

  if (!userId) {
    throw new Error('You must be signed in to save underspending.')
  }

  const amount = Number(formData.get('amount') ?? 0)

  await recordSaving({
    userId,
    amount,
    date: new Date(),
    source: 'underspending',
    destination: 'buffer',
    notes: 'Saved remaining budget to weekly buffer',
  })

  revalidatePath('/finance')
  revalidatePath('/finance/today')
}

export async function recordException(formData: FormData): Promise<void> {
  const userId = await resolveUserId()

  if (!userId) {
    throw new Error('You must be signed in to record an exception.')
  }

  const plannedAmount = Number(formData.get('plannedAmount') ?? 0)
  const actualAmount = Number(formData.get('actualAmount') ?? 0)
  const category = String(formData.get('category') ?? 'other')
  const reason = String(formData.get('reason') ?? '').trim() || 'Unplanned spending'
  const resolution = String(formData.get('resolution') ?? '').trim() || 'Review next cycle'

  await createBudgetException({
    userId,
    date: new Date(),
    plannedAmount,
    actualAmount,
    category,
    reason,
    resolution,
  })

  revalidatePath('/finance')
  revalidatePath('/finance/today')
}
