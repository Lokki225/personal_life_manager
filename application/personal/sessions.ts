import { PersonalRuleError } from '../../domain/personal/errors'
import { MAX_SESSION_MINUTES, seriesKey, sessionMinutes } from '../../domain/personal/sessions'
import { addDays, startOfDay } from '../../domain/personal/tasks'
import { goalRepository } from '../../infrastructure/repositories/goalRepository'
import { personalRepository } from '../../infrastructure/repositories/personalRepository'
import { now as clockNow } from '../../lib/clock'

type Deps = typeof personalRepository & Pick<typeof goalRepository, 'getTree'>

const defaultDeps: Deps = { ...personalRepository, getTree: goalRepository.getTree }

async function checkGoal(userId: string, goalId: string | null, deps: Deps) {
  if (goalId && !(await deps.getTree(userId, goalId, 'personal'))) {
    throw new PersonalRuleError('Choose one of your goals.', 'goalId')
  }
}

// Starts timing. One session runs at a time.
export async function startSession(userId: string, goalId: string | null, now: Date = clockNow(), deps: Deps = defaultDeps) {
  if (await deps.getRunningSession(userId)) {
    throw new PersonalRuleError('A session is already running. Stop it first.')
  }

  await checkGoal(userId, goalId, deps)
  return deps.createSession(userId, { goalId, startedAt: now, endedAt: null, durationMin: null, note: null })
}

export async function stopSession(userId: string, note: string | null, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const running = await deps.getRunningSession(userId)

  if (!running) {
    throw new PersonalRuleError('No session is running.')
  }

  // A session left running for days is closed at the longest one allowed.
  const minutes = Math.min(sessionMinutes(running.startedAt, now), MAX_SESSION_MINUTES)
  await deps.finishSession(userId, running.id, now, minutes, note?.trim() || null)
}

// A session recorded afterwards: how long, and when it ended.
export async function logSession(
  userId: string,
  input: { minutes: number; goalId: string | null; note: string | null; endedAt: Date },
  deps: Deps = defaultDeps,
) {
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_SESSION_MINUTES) {
    throw new PersonalRuleError('Enter between 1 and 960 minutes.', 'minutes')
  }

  await checkGoal(userId, input.goalId, deps)
  const startedAt = new Date(input.endedAt.getTime() - input.minutes * 60_000)

  return deps.createSession(userId, {
    goalId: input.goalId,
    startedAt,
    endedAt: input.endedAt,
    durationMin: input.minutes,
    note: input.note?.trim() || null,
  })
}

export async function deleteSession(userId: string, sessionId: string, deps: Deps = defaultDeps) {
  if (!(await deps.deleteSession(userId, sessionId))) {
    throw new PersonalRuleError('This session no longer exists.')
  }
}

// The running session and the time spent today.
export async function getSessionsToday(userId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const today = startOfDay(now)
  const [running, sessions] = await Promise.all([deps.getRunningSession(userId), deps.listSessions(userId, today, addDays(today, 1))])

  return {
    running: running
      ? { id: running.id, goal: running.goal, startedAt: running.startedAt, elapsedSeconds: Math.max(Math.floor((now.getTime() - running.startedAt.getTime()) / 1000), 0) }
      : null,
    sessions,
    totalMinutes: sessions.reduce((sum, s) => sum + (s.durationMin ?? 0), 0),
  }
}

// --- Metric series ------------------------------------------------------------

export const listMeasures = (userId: string, deps: Deps = defaultDeps) => deps.listSeries(userId)

export async function createSeries(userId: string, input: { label: string; unit: string | null }, deps: Deps = defaultDeps) {
  const label = input.label.trim()

  if (!label) throw new PersonalRuleError('Name what you measure.', 'seriesLabel')
  if (label.length > 40) throw new PersonalRuleError('Keep it under 40 characters.', 'seriesLabel')

  const taken = (await deps.listSeries(userId)).map((series) => series.key)
  return deps.createSeries(userId, { key: seriesKey(label, taken), label, unit: input.unit?.trim().slice(0, 12) || null })
}

export async function logMetric(userId: string, seriesId: string, value: number, recordedAt: Date, deps: Deps = defaultDeps) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
    throw new PersonalRuleError('Enter a number.', 'value')
  }

  if (!(await deps.addEntry(userId, seriesId, value, recordedAt))) {
    throw new PersonalRuleError('This measure no longer exists.')
  }
}
