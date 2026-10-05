import { cache } from 'react'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/infrastructure/prisma/client'

export type SignedInUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  picture: string | null
  role: 'USER' | 'ADMIN'
  lastSeenAt: Date | null
  locale: string | null
  timeZone: string | null
  settledThrough: Date | null
  bufferSweepDay: number
}

// The user who actually signed in, or null.
// A session cookie outlives the database it was issued for (after switching
// databases, or deleting a user), so it is checked against the User table.
// Cached for the request: a layout and its page both ask, and get one query.
export const getSignedInUser = cache(async (): Promise<SignedInUser | null> => {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: unknown; email?: unknown } | undefined
  const select = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    username: true,
    picture: true,
    role: true,
    lastSeenAt: true,
    locale: true,
    timeZone: true,
    settledThrough: true,
    bufferSweepDay: true,
  }

  // Only the id identifies the account: an email can be changed, so a session
  // is never matched to an account by its email.
  if (typeof sessionUser?.id === 'string' && sessionUser.id.length > 0) {
    return prisma.user.findUnique({ where: { id: sessionUser.id }, select })
  }

  return null
})

export async function getSignedInUserId(): Promise<string | null> {
  return (await getSignedInUser())?.id ?? null
}

// Same, with the DEFAULT_USER_ID fallback used when nobody is signed in.
export async function getSessionUserId(): Promise<string | null> {
  return (await getSignedInUserId()) ?? (process.env.DEFAULT_USER_ID || null)
}

export async function resolveSessionUserId(): Promise<string> {
  const userId = await getSessionUserId()

  if (!userId) {
    throw new Error('No authenticated user found for finance setup.')
  }

  return userId
}
