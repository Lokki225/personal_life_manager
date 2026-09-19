import { describe, expect, it, vi } from 'vitest'

import { createProject } from './createProject'

describe('createProject', () => {
  it('creates a project for the authenticated user', async () => {
    const repository = {
      createProject: vi.fn().mockResolvedValue({
        id: 'project-1',
        userId: 'user-1',
        name: 'Travel',
        notes: 'Summer trip',
      }),
      listProjects: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
    }

    const result = await createProject(
      {
        userId: 'user-1',
        name: 'Travel',
        notes: 'Summer trip',
      },
      repository,
    )

    expect(repository.createProject).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Travel',
        notes: 'Summer trip',
      }),
    )
    expect(result.name).toBe('Travel')
  })
})
