import { cookies } from 'next/headers'

import { openUnlock, sealUnlock, UNLOCK_MINUTES, unlockCookieName } from '@/infrastructure/auth/unlockToken'

// The cookies that keep a locked entry open for a few minutes after its
// password is given. Read in pages; written only in server actions.

const secret = () => {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET is not set')
  return value
}

// Gives, for this request, the key of each entry that is unlocked.
export async function unlockedKeys(userId: string): Promise<(entryId: string) => Buffer | null> {
  const store = await cookies()
  return (entryId) => openUnlock(secret(), userId, entryId, store.get(unlockCookieName(entryId))?.value)
}

export async function rememberUnlock(userId: string, entryId: string, key: Buffer) {
  ;(await cookies()).set(unlockCookieName(entryId), sealUnlock(secret(), userId, entryId, key), {
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
