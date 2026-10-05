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
import { securityRepository } from '../../infrastructure/repositories/securityRepository'

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
  const owned = await deps.ownedTargets(
    userId,
    links.filter((l) => l.targetType === 'goal').map((l) => l.targetId),
    links.filter((l) => l.targetType === 'task').map((l) => l.targetId),
  )

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

export async function createEntry(userId: string, input: EntryInput & { password: string | null }, deps: Deps = journalRepository) {
  if (input.password !== null) checkPassword(input.password)
  const { data, links } = await prepare(userId, input, deps)
  return deps.createEntry(userId, data, links, input.password)
}

// Editing a locked entry needs it unlocked first (`unlocked`).
export async function updateEntry(userId: string, id: string, input: EntryInput, unlocked: boolean, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured && !unlocked) throw new PersonalRuleError('Unlock this entry first.')

  const { data, links } = await prepare(userId, input, deps)
  await deps.updateEntry(userId, id, data, links)
}

async function ownEntry(userId: string, id: string, deps: Deps) {
  const entry = await deps.getEntry(userId, id)
  if (!entry) throw new PersonalRuleError('This entry no longer exists.')
  return entry
}

// Wrong passwords allowed for one entry before it waits.
const UNLOCK_LIMIT = 5
const UNLOCK_WINDOW_MS = 15 * 60 * 1000

type Guard = Pick<typeof securityRepository, 'isLimited' | 'recordAttempt'>

// Checks an entry's password, slowing guesses down: after 5 wrong ones in 15
// minutes, even the right one waits.
async function guardedCheck(userId: string, id: string, password: string, deps: Deps, guard: Guard) {
  const key = `unlock:${userId}:${id}`
  if (await guard.isLimited(key, UNLOCK_LIMIT, UNLOCK_WINDOW_MS)) {
    throw new PersonalRuleError('Too many wrong passwords. Try again in 15 minutes.', 'password')
  }
  const ok = await deps.checkPassword(userId, id, password)
  if (!ok) await guard.recordAttempt(key)
  return ok
}

// True when the password opens the entry.
export async function unlockEntry(userId: string, id: string, password: string, deps: Deps = journalRepository, guard: Guard = securityRepository) {
  await ownEntry(userId, id, deps)
  return guardedCheck(userId, id, password, deps, guard)
}

// Locks an open entry, or (with its current password) takes the lock off.
export async function lockEntry(userId: string, id: string, password: string, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured) throw new PersonalRuleError('This entry is already locked.')
  checkPassword(password)
  await deps.setLock(userId, id, password)
}

export async function removeLock(
  userId: string,
  id: string,
  currentPassword: string,
  deps: Deps = journalRepository,
  guard: Guard = securityRepository,
) {
  const entry = await ownEntry(userId, id, deps)
  if (!entry.isSecured) return
  if (!(await guardedCheck(userId, id, currentPassword, deps, guard))) throw new PersonalRuleError('That is not the password.', 'password')
  await deps.setLock(userId, id, null)
}

export async function deleteEntry(userId: string, id: string, unlocked: boolean, deps: Deps = journalRepository) {
  const entry = await ownEntry(userId, id, deps)
  if (entry.isSecured && !unlocked) throw new PersonalRuleError('Unlock this entry first.')
  await deps.deleteEntry(userId, id)
}

// What may be shown of an entry: a locked one shows only its date and kind.
export function visibleEntry(entry: EntryRecord, unlocked: boolean) {
  const open = !entry.isSecured || unlocked
  return {
    id: entry.id,
    type: entry.type,
    entryDate: entry.entryDate,
    reviewOn: entry.reviewOn,
    isSecured: entry.isSecured,
    locked: !open,
    title: open ? entry.title : null,
    body: open ? entry.body : null,
    preview: open ? excerpt(entry.body) : null,
    mood: open ? entry.mood : null,
    energy: open ? entry.energy : null,
  }
}

export type VisibleEntry = ReturnType<typeof visibleEntry>

export async function listEntries(userId: string, type: JournalType | null, deps: Deps = journalRepository) {
  return (await deps.listEntries(userId, type)).map((entry) => visibleEntry(entry, false))
}

export async function getEntry(userId: string, id: string, isUnlocked: (id: string) => boolean, deps: Deps = journalRepository) {
  const entry = await deps.getEntry(userId, id)
  return entry ? visibleEntry(entry, isUnlocked(entry.id)) : null
}

// The entries that mention a goal or a task, for its page.
export async function linkedEntries(userId: string, targetType: 'goal' | 'task', targetId: string, deps: Deps = journalRepository) {
  return (await deps.listLinkedEntries(userId, targetType, targetId)).map((entry) => visibleEntry(entry, false))
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
