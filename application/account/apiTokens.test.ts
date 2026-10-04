import { describe, expect, it, vi } from 'vitest'

import { checkApiAccess, createApiToken, deleteApiToken, MAX_API_TOKENS } from './apiTokens'

const now = new Date(2026, 9, 3, 12)
const owner = (scope: 'READ' | 'WRITE', lastUsedAt: Date | null = null) => ({
  tokenId: 'token-1',
  tokenName: 'Assistant',
  scope,
  lastUsedAt,
  user: { id: 'user-1', email: 'awa@example.com', firstName: 'Awa', lastName: null, username: null, locale: 'fr', timeZone: null, settledThrough: null, bufferSweepDay: 0 },
})

const depsOf = (found: unknown, limited = false) => ({
  tokens: { findOwner: vi.fn().mockResolvedValue(found), markUsed: vi.fn() },
  security: { isLimited: vi.fn().mockResolvedValue(limited), recordAttempt: vi.fn() },
})

describe('API keys', () => {
  it('creates a key with a trimmed name, up to the maximum', async () => {
    const repository = { createToken: vi.fn().mockResolvedValue('plm_secret'), countTokens: vi.fn().mockResolvedValue(0) }

    await expect(createApiToken('user-1', { name: ' Assistant ', scope: 'WRITE' }, repository)).resolves.toBe('plm_secret')
    expect(repository.createToken).toHaveBeenCalledWith('user-1', 'Assistant', 'WRITE')

    repository.countTokens.mockResolvedValue(MAX_API_TOKENS)
    await expect(createApiToken('user-1', { name: 'One more', scope: 'READ' }, repository)).rejects.toThrow(
      'You have the maximum number of keys. Delete one first.',
    )
  })

  it('deletes only a key of the user', async () => {
    await deleteApiToken('user-1', 'token-1', { deleteToken: vi.fn().mockResolvedValue(true) })
    await expect(deleteApiToken('user-1', 'someone-else', { deleteToken: vi.fn().mockResolvedValue(false) })).rejects.toThrow(
      'This key no longer exists.',
    )
  })
})

describe('checkApiAccess', () => {
  it('lets a valid key through, counts the request and notes it was used', async () => {
    const deps = depsOf(owner('READ'))

    await expect(checkApiAccess('Bearer plm_secret', 'READ', deps, now)).resolves.toEqual({ ok: true, owner: owner('READ') })
    expect(deps.tokens.findOwner).toHaveBeenCalledWith('plm_secret')
    expect(deps.security.recordAttempt).toHaveBeenCalledWith('api:token-1')
    expect(deps.tokens.markUsed).toHaveBeenCalledWith('token-1', now)
  })

  it('does not rewrite "last used" on every request', async () => {
    const deps = depsOf(owner('READ', new Date(2026, 9, 3, 11, 30)))

    await checkApiAccess('Bearer plm_secret', 'READ', deps, now)

    expect(deps.tokens.markUsed).not.toHaveBeenCalled()
  })

  it('refuses a missing, malformed or unknown key with 401', async () => {
    for (const header of [null, '', 'plm_secret', 'Bearer not-a-key', 'Basic plm_secret']) {
      const deps = depsOf(owner('READ'))
      await expect(checkApiAccess(header, 'READ', deps, now)).resolves.toMatchObject({ ok: false, status: 401 })
      expect(deps.tokens.findOwner).not.toHaveBeenCalled()
    }

    await expect(checkApiAccess('Bearer plm_unknown', 'READ', depsOf(null), now)).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('refuses a read-only key that tries to record, with 403', async () => {
    const deps = depsOf(owner('READ'))

    await expect(checkApiAccess('Bearer plm_secret', 'WRITE', deps, now)).resolves.toMatchObject({ ok: false, status: 403 })
    expect(deps.security.recordAttempt).not.toHaveBeenCalled()

    await expect(checkApiAccess('Bearer plm_secret', 'WRITE', depsOf(owner('WRITE')), now)).resolves.toMatchObject({ ok: true })
  })

  it('refuses a key that goes too fast, with 429', async () => {
    const deps = depsOf(owner('WRITE'), true)

    await expect(checkApiAccess('Bearer plm_secret', 'READ', deps, now)).resolves.toMatchObject({ ok: false, status: 429 })
    expect(deps.security.recordAttempt).not.toHaveBeenCalled()
  })
})
