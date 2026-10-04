import { createHmac, timingSafeEqual } from 'node:crypto'

// A short-lived proof that a locked journal entry was opened with its
// password: "<expires>.<signature>", signed with the app's secret and bound
// to the entry and its owner. Friction, not encryption (Personal spec §8.2).

export const UNLOCK_MINUTES = 15

const signature = (secret: string, userId: string, entryId: string, expires: number) =>
  createHmac('sha256', secret).update(`${userId}:${entryId}:${expires}`).digest('base64url')

export function signUnlock(secret: string, userId: string, entryId: string, now: number = Date.now()): string {
  const expires = now + UNLOCK_MINUTES * 60_000
  return `${expires}.${signature(secret, userId, entryId, expires)}`
}

export function verifyUnlock(secret: string, userId: string, entryId: string, token: string | undefined, now: number = Date.now()): boolean {
  const [expiresText, given] = (token ?? '').split('.')
  const expires = Number(expiresText)

  if (!given || !Number.isFinite(expires) || expires < now) {
    return false
  }

  const expected = Buffer.from(signature(secret, userId, entryId, expires))
  const actual = Buffer.from(given)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const unlockCookieName = (entryId: string) => `pls_unlock_${entryId}`
