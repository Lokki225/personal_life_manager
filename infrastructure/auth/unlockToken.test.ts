import { describe, expect, it } from 'vitest'

import { signUnlock, verifyUnlock } from './unlockToken'

const secret = 'test-secret'
const now = 1_800_000_000_000

describe('unlock tokens', () => {
  it('opens the entry it was made for, for 15 minutes', () => {
    const token = signUnlock(secret, 'u1', 'e1', now)
    expect(verifyUnlock(secret, 'u1', 'e1', token, now + 14 * 60_000)).toBe(true)
    expect(verifyUnlock(secret, 'u1', 'e1', token, now + 16 * 60_000)).toBe(false)
  })

  it('opens nothing else, for nobody else, and refuses forgeries', () => {
    const token = signUnlock(secret, 'u1', 'e1', now)
    expect(verifyUnlock(secret, 'u1', 'e2', token, now)).toBe(false)
    expect(verifyUnlock(secret, 'u2', 'e1', token, now)).toBe(false)
    expect(verifyUnlock('other-secret', 'u1', 'e1', token, now)).toBe(false)
    expect(verifyUnlock(secret, 'u1', 'e1', `${now + 10 ** 9}.${token.split('.')[1]}`, now)).toBe(false)
    expect(verifyUnlock(secret, 'u1', 'e1', undefined, now)).toBe(false)
    expect(verifyUnlock(secret, 'u1', 'e1', 'garbage', now)).toBe(false)
  })
})
