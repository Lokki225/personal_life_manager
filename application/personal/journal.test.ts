import { describe, expect, it, vi } from 'vitest'

import { createEntry, deleteEntry, lockEntry, removeLock, saveDailyNote, updateEntry, visibleEntry } from './journal'

const day = new Date(2026, 9, 7, 21, 30)
const input = { type: 'FREE' as const, title: null, body: 'A good day.', mood: null, energy: null, entryDate: day, reviewOn: null }

const entry = (extra: object = {}) => ({
  id: 'e',
  type: 'FREE' as const,
  title: 'Title',
  body: 'Secret thoughts about @[Chess](goal:g1)',
  mood: 4,
  energy: 2,
  isSecured: false,
  entryDate: new Date(2026, 9, 7),
  reviewOn: null,
  createdAt: day,
  updatedAt: day,
  links: [],
  ...extra,
})

function repo(extra: object = {}) {
  return {
    ownedTargets: vi.fn(async () => new Set(['goal:g1'])),
    createEntry: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: 'e' })),
    updateEntry: vi.fn(async () => true),
    getEntry: vi.fn(async () => entry()),
    checkPassword: vi.fn(async (_u: string, _id: string, password: string) => password === 'open sesame'),
    setLock: vi.fn(async () => true),
    deleteEntry: vi.fn(async () => true),
    ...extra,
  }
}

describe('createEntry', () => {
  it('keeps links to the user’s own goals only, and dates the entry at midnight', async () => {
    const r = repo()
    await createEntry('u', { ...input, body: 'Played @[Chess](goal:g1) and @[Not mine](goal:x9)', password: null }, r as never)

    expect(r.createEntry).toHaveBeenCalledWith(
      'u',
      expect.objectContaining({ entryDate: new Date(2026, 9, 7), title: null }),
      [{ targetType: 'goal', targetId: 'g1', label: 'Chess' }],
      null,
    )
  })

  it('keeps a review date for decisions only', async () => {
    const r = repo()
    const reviewOn = new Date(2026, 11, 1, 15)
    await createEntry('u', { ...input, type: 'DECISION', reviewOn, password: null }, r as never)
    await createEntry('u', { ...input, reviewOn, password: null }, r as never)

    expect(r.createEntry.mock.calls[0][1]).toMatchObject({ reviewOn: new Date(2026, 11, 1) })
    expect(r.createEntry.mock.calls[1][1]).toMatchObject({ reviewOn: null })
  })

  it('points at what is wrong', async () => {
    const attempt = (extra: object) => createEntry('u', { ...input, password: null, ...extra }, repo() as never)
    await expect(attempt({ body: '  ' })).rejects.toMatchObject({ field: 'body' })
    await expect(attempt({ title: 'x'.repeat(81) })).rejects.toMatchObject({ field: 'title' })
    await expect(attempt({ mood: 6 })).rejects.toMatchObject({ field: 'mood' })
    await expect(attempt({ password: 'abc' })).rejects.toMatchObject({ field: 'password' })
  })
})

describe('locked entries', () => {
  const locked = () => repo({ getEntry: vi.fn(async () => entry({ isSecured: true })) })

  it('cannot be changed or deleted until unlocked', async () => {
    await expect(updateEntry('u', 'e', input, false, locked() as never)).rejects.toThrow('Unlock this entry first.')
    await expect(deleteEntry('u', 'e', false, locked() as never)).rejects.toThrow('Unlock this entry first.')

    const r = locked()
    await updateEntry('u', 'e', input, true, r as never)
    expect(r.updateEntry).toHaveBeenCalled()
  })

  it('lose their lock only with the current password', async () => {
    const r = locked()
    await expect(removeLock('u', 'e', 'guess', r as never)).rejects.toMatchObject({ field: 'password' })
    await removeLock('u', 'e', 'open sesame', r as never)
    expect(r.setLock).toHaveBeenCalledWith('u', 'e', null)
  })

  it('are locked with a password of at least 4 characters, once', async () => {
    const r = repo()
    await expect(lockEntry('u', 'e', 'abc', r as never)).rejects.toMatchObject({ field: 'password' })
    await lockEntry('u', 'e', 'open sesame', r as never)
    expect(r.setLock).toHaveBeenCalledWith('u', 'e', 'open sesame')
    await expect(lockEntry('u', 'e', 'open sesame', locked() as never)).rejects.toThrow('This entry is already locked.')
  })

  it('show only their date and kind until unlocked', () => {
    const shown = visibleEntry(entry({ isSecured: true }), false)
    expect(shown).toMatchObject({ locked: true, title: null, body: null, preview: null, mood: null, type: 'FREE' })
    expect(visibleEntry(entry({ isSecured: true }), true)).toMatchObject({ locked: false, preview: 'Secret thoughts about Chess' })
  })
})

describe('saveDailyNote', () => {
  it('writes today’s daily note the first time', async () => {
    const r = repo({ findDailyNote: vi.fn(async () => null) })
    await saveDailyNote('u', 'Quiet day.', day, r as never)

    expect(r.createEntry).toHaveBeenCalledWith('u', expect.objectContaining({ type: 'DAILY', body: 'Quiet day.', entryDate: new Date(2026, 9, 7) }), [], null)
  })

  it('replaces its text afterwards, keeping the mood already given', async () => {
    const r = repo({ findDailyNote: vi.fn(async () => entry({ type: 'DAILY', mood: 4, title: null })) })
    await saveDailyNote('u', 'Better than expected.', day, r as never)

    expect(r.createEntry).not.toHaveBeenCalled()
    expect(r.updateEntry).toHaveBeenCalledWith('u', 'e', expect.objectContaining({ body: 'Better than expected.', mood: 4 }), [])
  })
})
