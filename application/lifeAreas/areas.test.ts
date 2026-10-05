import { describe, expect, it, vi } from 'vitest'

import { createLifeArea, moveLifeArea, setGoalArea } from './areas'

const area = (id: string, name: string) => ({ id, name, statement: null, color: null, icon: null, sortOrder: 0, userId: 'u', createdAt: new Date(), _count: { goals: 0 } })

function repo(extra: object = {}) {
  return {
    list: vi.fn(async () => [area('a', 'Tech'), area('b', 'Music')]),
    create: vi.fn(async () => ({ id: 'new' })),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    reorder: vi.fn(async () => {}),
    owns: vi.fn(async (_u: string, id: string) => id === 'a'),
    setGoalArea: vi.fn(async () => true),
    ...extra,
  }
}

describe('life area use cases', () => {
  it('add an area at the end, under a name not taken', async () => {
    const r = repo()
    await createLifeArea('u', { name: 'Family', statement: null, color: 'rose', icon: 'heart' }, r as never)
    expect(r.create).toHaveBeenCalledWith('u', { name: 'Family', statement: null, color: 'rose', icon: 'heart' }, 2)
    await expect(createLifeArea('u', { name: 'music', statement: null, color: null, icon: null }, r as never)).rejects.toMatchObject({ field: 'name' })
  })

  it('stop at twelve areas', async () => {
    const r = repo({ list: vi.fn(async () => Array.from({ length: 12 }, (_, i) => area(`a${i}`, `A${i}`))) })
    await expect(createLifeArea('u', { name: 'One more', statement: null, color: null, icon: null }, r as never)).rejects.toThrow('Twelve areas at most')
  })

  it('reorder by moving one area', async () => {
    const r = repo()
    await moveLifeArea('u', 'b', 'up', r as never)
    expect(r.reorder).toHaveBeenCalledWith('u', ['b', 'a'])
  })

  it('give a goal only one of the person’s areas, or none', async () => {
    const r = repo()
    await setGoalArea('u', 'g1', 'a', r as never)
    await setGoalArea('u', 'g1', null, r as never)
    expect(r.setGoalArea.mock.calls).toEqual([
      ['u', 'g1', 'a'],
      ['u', 'g1', null],
    ])
    await expect(setGoalArea('u', 'g1', 'x9', r as never)).rejects.toMatchObject({ field: 'lifeAreaId' })
    await expect(setGoalArea('u', 'g9', 'a', repo({ setGoalArea: vi.fn(async () => false) }) as never)).rejects.toThrow('This goal no longer exists.')
  })
})
