import { describe, expect, it, vi } from 'vitest'

import { changeCredentials, changeUserRole, listUsersForAdmin, MAX_PICTURE_LENGTH, updateProfile } from './profile'

const admin = { id: 'admin-1', role: 'ADMIN' as const }
const user = { id: 'user-1', role: 'USER' as const }

describe('updateProfile', () => {
  const picture = 'data:image/jpeg;base64,AAAA'
  const names = { firstName: ' Awa ', lastName: 'Koné' }
  const today = new Date(2026, 9, 2)
  const stored = {
    firstName: 'Awa',
    lastName: 'Koné',
    username: null,
    bio: null,
    occupation: null,
    phone: null,
    country: null,
    city: null,
    birthDate: null,
  }

  it('trims the names, stores empty optional fields as nothing, and passes the picture as given', async () => {
    const repository = { updateProfile: vi.fn() }

    await updateProfile('user-1', { ...names, username: ' ', city: ' Abidjan ', picture }, repository, today)
    await updateProfile('user-1', { ...names, picture: null }, repository, today)
    await updateProfile('user-1', names, repository, today)

    expect(repository.updateProfile.mock.calls).toEqual([
      ['user-1', { ...stored, city: 'Abidjan', picture }],
      ['user-1', { ...stored, picture: null }],
      ['user-1', { ...stored, picture: undefined }],
    ])
  })

  it('refuses anything that is not a small JPEG, PNG or WebP image', async () => {
    const repository = { updateProfile: vi.fn() }

    for (const bad of [
      'https://example.com/me.png',
      'data:image/svg+xml;base64,AAAA',
      'data:text/html;base64,AAAA',
      `data:image/png;base64,${'A'.repeat(MAX_PICTURE_LENGTH)}`,
    ]) {
      await expect(updateProfile('user-1', { ...names, picture: bad }, repository, today)).rejects.toMatchObject({
        field: 'picture',
      })
    }
    expect(repository.updateProfile).not.toHaveBeenCalled()
  })

  it('refuses a date of birth in the future or too far back', async () => {
    const repository = { updateProfile: vi.fn() }

    for (const birthDate of [new Date(2026, 9, 3), new Date(1850, 0, 1)]) {
      await expect(updateProfile('user-1', { ...names, birthDate }, repository, today)).rejects.toMatchObject({
        field: 'birthDate',
      })
    }

    await updateProfile('user-1', { ...names, birthDate: new Date(1998, 4, 12) }, repository, today)
    expect(repository.updateProfile).toHaveBeenCalledTimes(1)
  })
})

describe('changeCredentials', () => {
  const repositoryOf = (matches: boolean, saved = true) => ({
    passwordMatches: vi.fn().mockResolvedValue(matches),
    updateCredentials: vi.fn().mockResolvedValue(saved),
  })

  it('changes the email and the password once the current password is confirmed', async () => {
    const repository = repositoryOf(true)

    await changeCredentials(
      'user-1',
      { currentPassword: 'old-secret', email: ' Awa@Example.com ', newPassword: 'new-secret' },
      repository,
    )
    await changeCredentials('user-1', { currentPassword: 'old-secret', email: 'awa@example.com', newPassword: '' }, repository)

    expect(repository.passwordMatches).toHaveBeenCalledWith('user-1', 'old-secret')
    expect(repository.updateCredentials.mock.calls).toEqual([
      ['user-1', { email: 'awa@example.com', password: 'new-secret' }],
      ['user-1', { email: 'awa@example.com', password: undefined }],
    ])
  })

  it('refuses a wrong current password, and an email another account uses', async () => {
    const wrong = repositoryOf(false)

    await expect(
      changeCredentials('user-1', { currentPassword: 'guess', email: 'awa@example.com' }, wrong),
    ).rejects.toMatchObject({ field: 'currentPassword' })
    expect(wrong.updateCredentials).not.toHaveBeenCalled()

    await expect(
      changeCredentials('user-1', { currentPassword: 'old-secret', email: 'taken@example.com' }, repositoryOf(true, false)),
    ).rejects.toMatchObject({ message: 'Another account already uses this email.', field: 'email' })
  })
})

describe('administration', () => {
  it('lets an administrator list users and change someone else’s role', async () => {
    const repository = { listUsers: vi.fn().mockResolvedValue([]), setRole: vi.fn().mockResolvedValue(true) }

    await expect(listUsersForAdmin(admin, repository)).resolves.toEqual([])
    await changeUserRole(admin, 'user-1', 'ADMIN', repository)

    expect(repository.setRole).toHaveBeenCalledWith('user-1', 'ADMIN')
  })

  it('refuses a normal user, a change to one’s own role, and an unknown user', async () => {
    const repository = { listUsers: vi.fn(), setRole: vi.fn().mockResolvedValue(false) }

    await expect(listUsersForAdmin(user, repository)).rejects.toThrow('Only an administrator can do this.')
    await expect(changeUserRole(user, 'admin-1', 'USER', repository)).rejects.toThrow(
      'Only an administrator can do this.',
    )
    await expect(changeUserRole(admin, 'admin-1', 'USER', repository)).rejects.toThrow(
      'You cannot change your own role.',
    )
    expect(repository.setRole).not.toHaveBeenCalled()

    await expect(changeUserRole(admin, 'gone', 'USER', repository)).rejects.toThrow('This user no longer exists.')
  })
})
