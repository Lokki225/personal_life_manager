import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// Keeps a locked journal entry open for a few minutes after its password is
// given. The cookie carries the entry's key, encrypted with the app's secret
// and bound to the entry, its owner and an expiry: "<expires>.<sealed key>".

export const UNLOCK_MINUTES = 15

const cookieKey = (secret: string) => createHash('sha256').update(`${secret}:journal-unlock`).digest()
const binding = (userId: string, entryId: string, expires: number) => Buffer.from(`${userId}:${entryId}:${expires}`)

export function sealUnlock(secret: string, userId: string, entryId: string, entryKey: Buffer, now: number = Date.now()): string {
  const expires = now + UNLOCK_MINUTES * 60_000
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cookieKey(secret), iv)
  cipher.setAAD(binding(userId, entryId, expires))
  const data = Buffer.concat([cipher.update(entryKey), cipher.final()])
  return `${expires}.${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')}`
}

// The entry's key, or null when the cookie is missing, expired, or not for it.
export function openUnlock(secret: string, userId: string, entryId: string, token: string | undefined, now: number = Date.now()): Buffer | null {
  const [expiresText, payload] = (token ?? '').split('.')
  const expires = Number(expiresText)
  if (!payload || !Number.isFinite(expires) || expires < now) return null

  const raw = Buffer.from(payload, 'base64url')
  if (raw.length < 28 + 32) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', cookieKey(secret), raw.subarray(0, 12))
    decipher.setAAD(binding(userId, entryId, expires))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()])
  } catch {
    return null
  }
}

export const unlockCookieName = (entryId: string) => `pls_unlock_${entryId}`
