import { describe, expect, it, vi } from 'vitest'

import { changeUserRole, listUsersForAdmin, MAX_PICTURE_LENGTH, updateProfile } from './profile'

const admin = { id: 'admin-1', role: 'ADMIN' as const }
const user = { id: 'user-1', role: 'USER' as const }

describe('updateProfile', () => {
  const picture = 'data:image/jpeg;base64,AAAA'

  it('saves a trimmed username, and the picture as given', async () => {
    const repository = { updateProfile: vi.fn() }

    await updateProfile('user-1', { username: '  Awa ', picture }, repository)
    await updateProfile('user-1', { username: 'Awa', picture: null }, repository)
    await updateProfile('user-1', { username: 'Awa' }, repository)

    expect(repository.updateProfile.mock.calls).toEqual([
      ['user-1', { username: 'Awa', picture }],
      ['user-1', { username: 'Awa', picture: null }],
      ['user-1', { username: 'Awa', picture: undefined }],
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
      await expect(updateProfile('user-1', { username: 'Awa', picture: bad }, repository)).rejects.toMatchObject({
        field: 'picture',
      })
    }
    expect(repository.updateProfile).not.toHaveBeenCalled()
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
