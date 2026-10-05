import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto'

// Locked journal entries are stored encrypted (security plan, decision D1):
// AES-256-GCM, with a key derived from the entry's password by scrypt. Without
// the password, the database holds only noise.
//
// Stored form: "plm1.<salt>.<iv>.<tag>.<ciphertext>", each part base64url.

export type EntryKey = Buffer
export type EntryContent = { title: string | null; body: string }

const PREFIX = 'plm1'
// scrypt cost: about 32 MB of memory and a tenth of a second per try.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

const b64 = (data: Buffer) => data.toString('base64url')
const fromB64 = (text: string) => Buffer.from(text, 'base64url')

export const isSealed = (body: string) => body.startsWith(`${PREFIX}.`)

export const newSalt = () => randomBytes(16)

export function deriveKey(password: string, salt: Buffer): Promise<EntryKey> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, 32, SCRYPT, (error, key) => (error ? reject(error) : resolve(key))),
  )
}

// The salt a sealed entry was locked with, to derive its key again.
export function saltOf(sealed: string): Buffer {
  return fromB64(sealed.split('.')[1] ?? '')
}

export function sealEntry(key: EntryKey, salt: Buffer, content: EntryContent): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()])
  return [PREFIX, b64(salt), b64(iv), b64(cipher.getAuthTag()), b64(data)].join('.')
}

// The entry's content, or null when the key does not open it.
export function openEntry(key: EntryKey, sealed: string): EntryContent | null {
  const [prefix, , iv, tag, data] = sealed.split('.')
  if (prefix !== PREFIX || !iv || !tag || data === undefined) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, fromB64(iv))
    decipher.setAuthTag(fromB64(tag))
    const text = Buffer.concat([decipher.update(fromB64(data)), decipher.final()]).toString('utf8')
    const content = JSON.parse(text) as EntryContent
    return typeof content.body === 'string' ? { title: content.title ?? null, body: content.body } : null
  } catch {
    return null
  }
}
