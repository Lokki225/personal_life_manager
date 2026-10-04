import { cookies } from 'next/headers'

import { signUnlock, UNLOCK_MINUTES, unlockCookieName, verifyUnlock } from '@/infrastructure/auth/unlockToken'

// The cookies that keep a locked entry open for a few minutes after its
// password is given. Read in pages; written only in server actions.

const secret = () => {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET is not set')
  return value
}

// Tells, for this request, which entries are unlocked.
export async function unlockedChecker(userId: string): Promise<(entryId: string) => boolean> {
  const store = await cookies()
  return (entryId) => verifyUnlock(secret(), userId, entryId, store.get(unlockCookieName(entryId))?.value)
}

export async function rememberUnlock(userId: string, entryId: string) {
  ;(await cookies()).set(unlockCookieName(entryId), signUnlock(secret(), userId, entryId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/personal',
    maxAge: UNLOCK_MINUTES * 60,
  })
}

export async function forgetUnlock(entryId: string) {
  ;(await cookies()).set(unlockCookieName(entryId), '', { path: '/personal', maxAge: 0 })
}
