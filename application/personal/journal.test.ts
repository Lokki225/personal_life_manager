import { describe, expect, it, vi } from 'vitest'

import { deriveKey, isSealed, newSalt, openEntry, saltOf, sealEntry } from '../../infrastructure/crypto/entryCipher'

import { createEntry, deleteEntry, getEntry, lockEntry, removeLock, saveDailyNote, unlockEntry, updateEntry, visibleEntry } from './journal'

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
    setContent: vi.fn(async () => {}),
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
  // A limiter that remembers wrong passwords in memory.
  const guard = () => {
    const hits: string[] = []
    return {
      isLimited: async (key: string, limit: number) => hits.filter((hit) => hit === key).length >= limit,
      recordAttempt: async (key: string) => void hits.push(key),
    }
  }

  // An entry locked with "open sesame", stored as the app stores it now.
  async function sealedEntry() {
    const salt = newSalt()
    const key = await deriveKey('open sesame', salt)
    return { key, record: entry({ isSecured: true, title: null, body: sealEntry(key, salt, { title: 'Title', body: 'Secret thoughts' }) }) }
  }
  const lockedRepo = (record: object) => repo({ getEntry: vi.fn(async () => record) })

  it('are stored sealed: the database never holds the text', async () => {
    const r = repo()
    await createEntry('u', { ...input, title: 'Hidden', body: 'Very private', password: 'open sesame' }, r as never)

    const [, data, , password] = r.createEntry.mock.calls[0] as [string, { title: string | null; body: string }, unknown, string]
    expect(password).toBe('open sesame')
    expect(data.title).toBeNull()
    expect(isSealed(data.body)).toBe(true)
    expect(data.body).not.toContain('private')
    expect(openEntry(await deriveKey('open sesame', saltOf(data.body)), data.body)).toEqual({ title: 'Hidden', body: 'Very private' })
  })

  it('give their key to the right password only, and stop after 5 wrong ones', async () => {
    const { key, record } = await sealedEntry()
    const r = lockedRepo(record)
    const g = guard()

    expect(await unlockEntry('u', 'e', 'open sesame', r as never, g)).toEqual(key)
    for (let i = 0; i < 5; i++) expect(await unlockEntry('u', 'e', `guess ${i}`, r as never, g)).toBeNull()
    await expect(unlockEntry('u', 'e', 'open sesame', r as never, g)).rejects.toThrow('Too many wrong passwords. Try again in 15 minutes.')
  })

  it('locked before encryption are sealed the first time their password is given', async () => {
    const r = lockedRepo(entry({ isSecured: true }))
    const key = await unlockEntry('u', 'e', 'open sesame', r as never, guard())

    const [, , content] = r.setContent.mock.calls[0] as unknown as [string, string, { title: string | null; body: string }]
    expect(content.title).toBeNull()
    expect(openEntry(key!, content.body)).toEqual({ title: 'Title', body: 'Secret thoughts about @[Chess](goal:g1)' })
  })

  it('cannot be changed or deleted without their key, and stay sealed when changed', async () => {
    const { key, record } = await sealedEntry()
    await expect(updateEntry('u', 'e', input, null, lockedRepo(record) as never)).rejects.toThrow('Unlock this entry first.')
    await expect(updateEntry('u', 'e', input, Buffer.alloc(32), lockedRepo(record) as never)).rejects.toThrow('Unlock this entry first.')
    await expect(deleteEntry('u', 'e', false, lockedRepo(record) as never)).rejects.toThrow('Unlock this entry first.')

    const r = lockedRepo(record)
    await updateEntry('u', 'e', { ...input, body: 'New words' }, key, r as never)
    const [, , data] = r.updateEntry.mock.calls[0] as unknown as [string, string, { body: string }]
    expect(openEntry(key, data.body)?.body).toBe('New words')
  })

  it('are locked with a password of at least 4 characters, once, and sealed then', async () => {
    const r = repo()
    await expect(lockEntry('u', 'e', 'abc', r as never)).rejects.toMatchObject({ field: 'password' })
    await lockEntry('u', 'e', 'open sesame', r as never)

    const [, , password, content] = r.setLock.mock.calls[0] as unknown as [string, string, string, { title: null; body: string }]
    expect(password).toBe('open sesame')
    expect(content.title).toBeNull()
    expect(openEntry(await deriveKey('open sesame', saltOf(content.body)), content.body)?.title).toBe('Title')
    await expect(lockEntry('u', 'e', 'open sesame', lockedRepo(entry({ isSecured: true })) as never)).rejects.toThrow('This entry is already locked.')
  })

  it('lose their lock only with the current password, and are stored plain again', async () => {
    const { record } = await sealedEntry()
    const r = lockedRepo(record)
    await expect(removeLock('u', 'e', 'guess', r as never, guard())).rejects.toMatchObject({ field: 'password' })
    await removeLock('u', 'e', 'open sesame', r as never, guard())
    expect(r.setLock).toHaveBeenCalledWith('u', 'e', null, { title: 'Title', body: 'Secret thoughts' })
  })

  it('show only their date and kind until opened with their key', async () => {
    const { key, record } = await sealedEntry()
    expect(visibleEntry(record)).toMatchObject({ locked: true, title: null, body: null, preview: null, mood: null, type: 'FREE' })
    expect(await getEntry('u', 'e', () => null, lockedRepo(record) as never)).toMatchObject({ locked: true, body: null })
    expect(await getEntry('u', 'e', () => key, lockedRepo(record) as never)).toMatchObject({ locked: false, title: 'Title', body: 'Secret thoughts', mood: 4 })
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
  it('keeps a line written later, when an older one arrives from a device', async () => {
    const r = repo({ findDailyNote: vi.fn(async () => entry({ type: 'DAILY', updatedAt: new Date(2026, 9, 7, 22) })) })

    await saveDailyNote('u', 'Written offline at nine.', day, r as never, new Date(2026, 9, 7, 21))
    expect(r.updateEntry).not.toHaveBeenCalled()

    await saveDailyNote('u', 'Written offline at eleven.', day, r as never, new Date(2026, 9, 7, 23))
    expect(r.updateEntry).toHaveBeenCalledWith('u', 'e', expect.objectContaining({ body: 'Written offline at eleven.' }), [])
  })
})
