import { describe, expect, it } from 'vitest'

import { openUnlock, sealUnlock } from './unlockToken'

const secret = 'test-secret'
const now = 1_800_000_000_000
const key = Buffer.alloc(32, 7)

describe('unlock tokens', () => {
  it('give back the entry’s key, for 15 minutes', () => {
    const token = sealUnlock(secret, 'u1', 'e1', key, now)
    expect(openUnlock(secret, 'u1', 'e1', token, now + 14 * 60_000)).toEqual(key)
    expect(openUnlock(secret, 'u1', 'e1', token, now + 16 * 60_000)).toBeNull()
  })

  it('open nothing else, for nobody else, and refuse forgeries', () => {
    const token = sealUnlock(secret, 'u1', 'e1', key, now)
    expect(openUnlock(secret, 'u1', 'e2', token, now)).toBeNull()
    expect(openUnlock(secret, 'u2', 'e1', token, now)).toBeNull()
    expect(openUnlock('other-secret', 'u1', 'e1', token, now)).toBeNull()
    // A later expiry does not match what was sealed.
    expect(openUnlock(secret, 'u1', 'e1', `${now + 10 ** 9}.${token.split('.')[1]}`, now)).toBeNull()
    expect(openUnlock(secret, 'u1', 'e1', undefined, now)).toBeNull()
    expect(openUnlock(secret, 'u1', 'e1', 'garbage', now)).toBeNull()
  })

  it('do not show the key in the cookie', () => {
    const token = sealUnlock(secret, 'u1', 'e1', key, now)
    expect(Buffer.from(token.split('.')[1], 'base64url').includes(key)).toBe(false)
  })
})
