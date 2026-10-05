import { PersonalRuleError } from '../../domain/personal/errors'
import {
  excerpt,
  isScale,
  MAX_BODY,
  MAX_TITLE,
  MIN_PASSWORD,
  parseLinks,
  type JournalLink,
  type JournalType,
} from '../../domain/personal/journal'
import { startOfDay } from '../../domain/personal/tasks'
import { journalRepository, type EntryRecord } from '../../infrastructure/repositories/journalRepository'
import { logSecurityEvent, SECURITY_EVENTS } from '../../infrastructure/auth/securityLog'
import { securityRepository } from '../../infrastructure/repositories/securityRepository'
import {
  deriveKey,
  isSealed,
  newSalt,
  openEntry,
  saltOf,
  sealEntry,
  type EntryContent,
  type EntryKey,
} from '../../infrastructure/crypto/entryCipher'

type Deps = typeof journalRepository

export type EntryInput = {
  type: JournalType
  title: string | null
  body: string
  mood: number | null
  energy: number | null
  entryDate: Date
  reviewOn: Date | null
}

// Checks an entry and keeps only links to the user's own goals and tasks.
async function prepare(userId: string, input: EntryInput, deps: Deps) {
  const body = input.body.trim()
  const title = input.title?.trim() || null

  if (!body) throw new PersonalRuleError('Write something first.', 'body')
  if (body.length > MAX_BODY) throw new PersonalRuleError('Keep it under 10,000 characters.', 'body')
  if (title && title.length > MAX_TITLE) throw new PersonalRuleError('Keep it under 80 characters.', 'title')
  if (!isScale(input.mood)) throw new PersonalRuleError('Choose from 1 to 5.', 'mood')
  if (!isScale(input.energy)) throw new PersonalRuleError('Choose from 1 to 5.', 'energy')

  const links = parseLinks(body)
  const owned = await deps.ownedTargets(userId, links)

  return {
    data: {
      type: input.type,
      title,
      body,
      mood: input.mood,
      energy: input.energy,
      entryDate: startOfDay(input.entryDate),
      reviewOn: input.type === 'DECISION' && input.reviewOn ? startOfDay(input.reviewOn) : null,
    },
    links: links.filter((l): l is JournalLink => owned.has(`${l.targetType}:${l.targetId}`)),
  }
}

const checkPassword = (password: string) => {
  if (password.length < MIN_PASSWORD) throw new PersonalRuleError('Use at least 4 characters.', 'password')
  if (password.length > 100) throw new PersonalRuleError('Keep it under 100 characters.', 'password')
}

// A locked entry's title and body are stored sealed; the rest stays readable
// so lists can show its date and kind.
const sealed = <D extends EntryContent>(data: D, key: EntryKey, salt: Buffer): D => ({
  ...data,
  title: null,
  body: sealEntry(key, salt, { title: data.title, body: data.body }),
})

export async function createEntry(userId: string, input: EntryInput & { password: string | null }, deps: Deps = journalRepository) {
  if (input.password !== null) checkPassword(input.password)
  const { data, links } = await prepare(userId, input, deps)
  if (input.password === null) return deps.createEntry(userId, data, links, null)

  const salt = newSalt()
  return deps.createEntry(userId, sealed(data, await deriveKey(input.password, salt), salt), links, input.password)
}

// The content of a locked entry, when this key opens it.
const opened = (entry: EntryRecord, key: EntryKey | null) => (key && isSealed(entry.body) ? openEntry(key, entry.body) : null)

// Editing a locked entry needs its key, given while it is unlocked.
export async function updateEntry(userId: string, id: string, input: EntryInput, key: EntryKey | null, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured && !opened(entry, key)) throw new PersonalRuleError('Unlock this entry first.')

  const { data, links } = await prepare(userId, input, deps)
  await deps.updateEntry(userId, id, entry.isSecured ? sealed(data, key!, saltOf(entry.body)) : data, links)
}

async function ownEntry(userId: string, id: string, deps: Deps) {
  const entry = await deps.getEntry(userId, id)
  if (!entry) throw new PersonalRuleError('This entry no longer exists.')
  return entry
}

// Wrong passwords allowed for one entry before it waits.
const UNLOCK_LIMIT = 5
const UNLOCK_WINDOW_MS = 15 * 60 * 1000

type Guard = Pick<typeof securityRepository, 'isLimited' | 'recordAttempt'> & {
  // Writes the wrong password to the security log.
  logFailure?: (userId: string, entryId: string) => Promise<void>
}

const defaultGuard: Guard = {
  isLimited: securityRepository.isLimited,
  recordAttempt: securityRepository.recordAttempt,
  logFailure: (userId, entryId) => logSecurityEvent({ kind: SECURITY_EVENTS.unlockFailed, userId, subject: entryId }),
}

// Checks an entry's password, slowing guesses down: after 5 wrong ones in 15
// minutes, even the right one waits.
async function guardedCheck(userId: string, id: string, password: string, deps: Deps, guard: Guard) {
  const key = `unlock:${userId}:${id}`
  if (await guard.isLimited(key, UNLOCK_LIMIT, UNLOCK_WINDOW_MS)) {
    throw new PersonalRuleError('Too many wrong passwords. Try again in 15 minutes.', 'password')
  }
  const ok = await deps.checkPassword(userId, id, password)
  if (!ok) await Promise.all([guard.recordAttempt(key), guard.logFailure?.(userId, id)])
  return ok
}

// The entry's key when the password opens it, or null. An entry locked
// before encryption is sealed now, the first time its password is given.
export async function unlockEntry(userId: string, id: string, password: string, deps: Deps = journalRepository, guard: Guard = defaultGuard) {
  const entry = await ownEntry(userId, id, deps)
  if (!(await guardedCheck(userId, id, password, deps, guard))) return null
  if (!entry.isSecured) return null

  if (isSealed(entry.body)) return deriveKey(password, saltOf(entry.body))

  const salt = newSalt()
  const key = await deriveKey(password, salt)
  await deps.setContent(userId, id, sealed({ title: entry.title, body: entry.body }, key, salt))
  return key
}

// Locks an open entry, or (with its current password) takes the lock off.
export async function lockEntry(userId: string, id: string, password: string, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured) throw new PersonalRuleError('This entry is already locked.')
  checkPassword(password)
  const salt = newSalt()
  await deps.setLock(userId, id, password, sealed({ title: entry.title, body: entry.body }, await deriveKey(password, salt), salt))
}

export async function removeLock(
  userId: string,
  id: string,
  currentPassword: string,
  deps: Deps = journalRepository,
  guard: Guard = defaultGuard,
) {
  const entry = await ownEntry(userId, id, deps)
  if (!entry.isSecured) return
  if (!(await guardedCheck(userId, id, currentPassword, deps, guard))) throw new PersonalRuleError('That is not the password.', 'password')

  // Stored plain again once the lock is off.
  const content = isSealed(entry.body) ? openEntry(await deriveKey(currentPassword, saltOf(entry.body)), entry.body) : null
  if (isSealed(entry.body) && !content) throw new PersonalRuleError('That is not the password.', 'password')
  await deps.setLock(userId, id, null, content ?? undefined)
}

export async function deleteEntry(userId: string, id: string, unlocked: boolean, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured && !unlocked) throw new PersonalRuleError('Unlock this entry first.')
  await deps.deleteEntry(userId, id)
}

// What may be shown of an entry: a locked one shows only its date and kind,
// unless its content was opened with its key.
export function visibleEntry(entry: EntryRecord, content: EntryContent | null = null) {
  const shown = entry.isSecured ? content : { title: entry.title, body: entry.body }
  const open = shown !== null
  return {
    id: entry.id,
    type: entry.type,
    entryDate: entry.entryDate,
    reviewOn: entry.reviewOn,
    isSecured: entry.isSecured,
    locked: !open,
    title: shown?.title ?? null,
    body: shown?.body ?? null,
    preview: shown ? excerpt(shown.body) : null,
    mood: open ? entry.mood : null,
    energy: open ? entry.energy : null,
  }
}

export type VisibleEntry = ReturnType<typeof visibleEntry>

export async function listEntries(userId: string, type: JournalType | null, deps: Deps = journalRepository) {
  return (await deps.listEntries(userId, type)).map((entry) => visibleEntry(entry))
}

export async function getEntry(userId: string, id: string, keyFor: (id: string) => EntryKey | null, deps: Deps = journalRepository) {
  const entry = await deps.getEntry(userId, id)
  return entry ? visibleEntry(entry, entry.isSecured ? opened(entry, keyFor(entry.id)) : null) : null
}

// The entries that mention a goal or a task, for its page.
export async function linkedEntries(userId: string, targetType: 'goal' | 'task', targetId: string, deps: Deps = journalRepository) {
  return (await deps.listLinkedEntries(userId, targetType, targetId)).map((entry) => visibleEntry(entry))
}

// The goals and tasks an entry can link to.
export async function linkOptions(userId: string, deps: Deps = journalRepository) {
  const { goals, tasks } = await deps.linkOptions(userId)
  return [
    ...goals.map((g) => ({ targetType: 'goal' as const, targetId: g.id, label: g.name })),
    ...tasks.map((t) => ({ targetType: 'task' as const, targetId: t.id, label: t.title })),
  ]
}

// --- The daily note -------------------------------------------------------------

export async function getDailyNote(userId: string, now: Date, deps: Deps = journalRepository) {
  const entry = await deps.findDailyNote(userId, startOfDay(now))
  return entry ? { id: entry.id, body: entry.body } : null
}

// "One line about today": writes today's daily note, or replaces its text.
// `writtenAt`, for a line sent later from a device, keeps a newer one.
export async function saveDailyNote(userId: string, text: string, now: Date, deps: Deps = journalRepository, writtenAt?: Date) {
  const input = { type: 'DAILY' as const, title: null, body: text, mood: null, energy: null, entryDate: now, reviewOn: null }
  const existing = await deps.findDailyNote(userId, startOfDay(now))

  if (existing && writtenAt && existing.updatedAt > writtenAt) {
    return
  }

  if (existing) {
    const { data, links } = await prepare(userId, { ...input, mood: existing.mood, energy: existing.energy, title: existing.title }, deps)
    await deps.updateEntry(userId, existing.id, data, links)
  } else {
    await createEntry(userId, { ...input, password: null }, deps)
  }
}
