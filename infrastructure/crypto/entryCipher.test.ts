import { describe, expect, it } from 'vitest'

import { deriveKey, isSealed, newSalt, openEntry, saltOf, sealEntry } from './entryCipher'

describe('entry cipher', () => {
  it('seals an entry so only its password opens it', async () => {
    const salt = newSalt()
    const key = await deriveKey('open sesame', salt)
    const sealed = sealEntry(key, salt, { title: 'Secret', body: 'Very private thoughts' })

    expect(isSealed(sealed)).toBe(true)
    expect(sealed).not.toContain('private')
    expect(openEntry(key, sealed)).toEqual({ title: 'Secret', body: 'Very private thoughts' })

    // The key is derived again from the password and the stored salt.
    expect(openEntry(await deriveKey('open sesame', saltOf(sealed)), sealed)?.body).toBe('Very private thoughts')
    expect(openEntry(await deriveKey('wrong', saltOf(sealed)), sealed)).toBeNull()
  })

  it('refuses a changed ciphertext and plain text', async () => {
    const salt = newSalt()
    const key = await deriveKey('pw12', salt)
    const sealed = sealEntry(key, salt, { title: null, body: 'abc' })
    const parts = sealed.split('.')
    parts[4] = Buffer.from('tampered').toString('base64url')

    expect(openEntry(key, parts.join('.'))).toBeNull()
    expect(openEntry(key, 'just text')).toBeNull()
    expect(isSealed('just text')).toBe(false)
  })

  it('locks two entries with the same password differently', async () => {
    const [a, b] = [newSalt(), newSalt()]
    const sealedA = sealEntry(await deriveKey('same', a), a, { title: null, body: 'x' })
    const sealedB = sealEntry(await deriveKey('same', b), b, { title: null, body: 'x' })
    expect(sealedA).not.toBe(sealedB)
  })
})
