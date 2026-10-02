import { describe, expect, it, vi } from 'vitest'

import { AccountRuleError } from './errors'
import { registerUser } from './registerUser'

const repositoryOf = (exists: boolean) => ({
  emailExists: vi.fn().mockResolvedValue(exists),
  createUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'awa@example.com' }),
})

describe('registerUser', () => {
  it('creates the account with a trimmed, lower-case email', async () => {
    const repository = repositoryOf(false)

    await expect(registerUser({ email: '  Awa@Example.com ', password: 'long-enough', firstName: ' Awa ', lastName: 'Koné ', username: ' ' }, repository)).resolves.toEqual({
      id: 'user-1',
      email: 'awa@example.com',
    })
    expect(repository.emailExists).toHaveBeenCalledWith('awa@example.com')
    expect(repository.createUser).toHaveBeenCalledWith('awa@example.com', 'long-enough', {
      firstName: 'Awa',
      lastName: 'Koné',
      username: null,
      timeZone: null,
    })
  })

  it('refuses an email that is already used, on the email field', async () => {
    const repository = repositoryOf(true)

    await expect(registerUser({ email: 'awa@example.com', password: 'long-enough', firstName: 'Awa', lastName: 'Koné' }, repository)).rejects.toMatchObject({
      message: 'An account already exists for this email. Sign in instead.',
      field: 'email',
    })
    expect(repository.createUser).not.toHaveBeenCalled()
  })

  it('refuses when another sign-up took the email in the meantime', async () => {
    const repository = repositoryOf(false)
    repository.createUser.mockResolvedValue(null)

    await expect(registerUser({ email: 'awa@example.com', password: 'long-enough', firstName: 'Awa', lastName: 'Koné' }, repository)).rejects.toThrow(
      AccountRuleError,
    )
  })
})
