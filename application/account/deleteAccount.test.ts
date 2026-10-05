import { describe, expect, it, vi } from 'vitest'

import { deleteAccount } from './deleteAccount'

const repo = (extra: object = {}) => ({
  passwordMatches: vi.fn(async () => true),
  countAdmins: vi.fn(async () => 2),
  deleteAccount: vi.fn(async () => {}),
  ...extra,
})

describe('deleteAccount', () => {
  it('deletes the account once the password is right', async () => {
    const r = repo()
    await deleteAccount({ id: 'u', role: 'USER' }, 'secret', r)

    expect(r.passwordMatches).toHaveBeenCalledWith('u', 'secret')
    expect(r.deleteAccount).toHaveBeenCalledWith('u')
  })

  it('refuses a wrong password, and deletes nothing', async () => {
    const r = repo({ passwordMatches: vi.fn(async () => false) })

    await expect(deleteAccount({ id: 'u', role: 'USER' }, 'guess', r)).rejects.toMatchObject({ field: 'password' })
    expect(r.deleteAccount).not.toHaveBeenCalled()
  })

  it('keeps the last administrator, but lets one of two leave', async () => {
    const last = repo({ countAdmins: vi.fn(async () => 1) })
    await expect(deleteAccount({ id: 'a', role: 'ADMIN' }, 'secret', last)).rejects.toThrow('only administrator')
    expect(last.deleteAccount).not.toHaveBeenCalled()

    const oneOfTwo = repo()
    await deleteAccount({ id: 'a', role: 'ADMIN' }, 'secret', oneOfTwo)
    expect(oneOfTwo.deleteAccount).toHaveBeenCalledWith('a')
  })
})
