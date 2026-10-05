import { describe, expect, it, vi } from 'vitest'

import { addFocus, bringToThisWeek, carryToNextWeek } from './week'

// Wednesday 7 October 2026; its week starts on Monday the 5th.
const now = new Date(2026, 9, 7, 12)
const monday = new Date(2026, 9, 5)
const nextMonday = new Date(2026, 9, 12)

function repo(extra: object = {}) {
  return {
    countFocus: vi.fn(async () => 2),
    addFocus: vi.fn(async () => ({ id: 'f' })),
    listFocus: vi.fn(async () => [
      { id: 'a', status: 'OPEN' },
      { id: 'b', status: 'DONE' },
      { id: 'c', status: 'OPEN' },
    ]),
    moveFocus: vi.fn(async () => 2),
    getFocus: vi.fn(async () => ({ id: 'old' })),
    ownsGoal: vi.fn(async (_u: string, id: string) => id === 'g1'),
    ownsOpportunity: vi.fn(async (_u: string, id: string) => id === 'o1'),
    ...extra,
  }
}

describe('focus items', () => {
  it('belong to the Monday of their week', async () => {
    const r = repo()
    await addFocus('u', { title: ' Send the application ', goalId: 'g1', opportunityId: 'o1' }, now, r as never)
    expect(r.addFocus).toHaveBeenCalledWith('u', { title: 'Send the application', week: monday, goalId: 'g1', opportunityId: 'o1' })
  })

  it('are three a week at most', async () => {
    const r = repo({ countFocus: vi.fn(async () => 3) })
    await expect(addFocus('u', { title: 'A fourth', goalId: null, opportunityId: null }, now, r as never)).rejects.toThrow('Three focus items a week at most')
    await expect(bringToThisWeek('u', 'old', now, r as never)).rejects.toThrow('Three focus items a week at most')
    expect(r.addFocus).not.toHaveBeenCalled()
    expect(r.moveFocus).not.toHaveBeenCalled()
  })

  it('link only the person’s own goals and opportunities', async () => {
    await expect(addFocus('u', { title: 'x', goalId: 'x9', opportunityId: null }, now, repo() as never)).rejects.toMatchObject({ field: 'goalId' })
    await expect(addFocus('u', { title: 'x', goalId: null, opportunityId: 'x9' }, now, repo() as never)).rejects.toMatchObject({ field: 'opportunityId' })
  })

  it('carry the unfinished ones to next Monday in one tap', async () => {
    const r = repo()
    await carryToNextWeek('u', now, r as never)
    expect(r.moveFocus).toHaveBeenCalledWith('u', ['a', 'c'], nextMonday)
  })
})
