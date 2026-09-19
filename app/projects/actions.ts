'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createProject } from '@/application/finance/createProject'
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

export async function createProjectAction(formData: FormData): Promise<void> {
  const userId = await resolveUserId()
  if (!userId) {
    throw new Error('You must be signed in to create a project.')
  }

  const name = String(formData.get('name') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (!name) {
    throw new Error('A project name is required.')
  }

  await createProject({
    userId,
    name,
    notes: notes || null,
  })

  revalidatePath('/finance')
  revalidatePath('/projects')
}
