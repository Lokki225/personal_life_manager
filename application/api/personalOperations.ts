import { z } from 'zod'

import { now } from '../../lib/clock'
import { listPersonalGoals } from '../personal/goals'
import { createEntry, getDailyNote } from '../personal/journal'
import { getSessionsToday, logSession } from '../personal/sessions'
import { addTask, getTodayTasks, setTaskDone } from '../personal/tasks'
import { dayField, idField, localTime, noInput, operation, text, type ApiUser } from './operation'

// What a program or the assistant can do in Personal: see the day, add and
// tick tasks, log time, write in the journal, and see goals.

const toDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

async function personalToday(user: ApiUser) {
  const at = now()
  const [{ entries, load, awaitingReason }, sessions, dailyNote] = await Promise.all([
    getTodayTasks(user.id, at),
    getSessionsToday(user.id, at),
    getDailyNote(user.id, at),
  ])

  return {
    tasks: entries.map(({ task, done }) => ({
      id: task.id,
      title: task.title,
      done,
      repeats: task.recurrence !== null,
      // Days it slipped to a later day so far.
      carriedOver: task.carryCount,
      category: task.category?.name ?? null,
    })),
    planned: load.planned,
    done: load.done,
    // A warning only: more tasks than the day can hold.
    capacity: load.capacity,
    overCapacity: load.overCapacity,
    waitingForAReason: awaitingReason.map((task) => task.id),
    runningSession: sessions.running ? { goal: sessions.running.goal?.name ?? null, startedAt: localTime(sessions.running.startedAt) } : null,
    sessionMinutesToday: sessions.totalMinutes,
    dailyNote: dailyNote?.body ?? null,
  }
}

async function personalGoals(user: ApiUser) {
  return (await listPersonalGoals(user.id, now())).map((goal) => ({
    id: goal.id,
    name: goal.name,
    // NOT_STARTED, IN_PROGRESS, ON_TRACK, BEHIND, ACHIEVED, MAINTAINING, LAPSED, EXPIRED, ABANDONED
    status: goal.evaluation.status,
    horizon: goal.horizon,
    deadline: localTime(goal.deadline),
    projected: localTime(goal.evaluation.projected),
    conditions: goal.evaluation.completion.map((r) => ({ actual: r.actual, target: r.condition.target, unit: r.condition.unit ?? null, met: r.satisfied })),
    steps: goal.evaluation.milestones.map((m) => ({ name: m.name, done: m.completedAt !== null })),
    // Goals timed by sessions take a "goalId" in log_session.
    usesSessions: goal.usesSessions,
  }))
}

export const personalOperations = {
  getPersonalToday: operation({
    name: 'get_personal_today',
    method: 'GET',
    path: '/personal/today',
    needs: 'READ',
    does: 'Personal today: the day’s tasks (done or not), how full the day is, time spent in sessions, and the one line about today.',
    input: noInput,
    run: personalToday,
  }),

  getPersonalGoals: operation({
    name: 'get_personal_goals',
    method: 'GET',
    path: '/personal/goals',
    needs: 'READ',
    does: 'Personal goals: their status, progress against their targets, steps and pace.',
    input: noInput,
    run: personalGoals,
  }),

  addTask: operation({
    name: 'add_task',
    method: 'POST',
    path: '/personal/tasks',
    needs: 'WRITE',
    does: 'Adds a Personal task: for today unless "date" is given, or to the inbox with "inbox": true.',
    status: 201,
    input: z.object({ title: text('title', 120), date: dayField.optional(), inbox: z.boolean().optional() }),
    run: async (user, { title, date, inbox }) => {
      await addTask(user.id, { title, dueDate: inbox ? null : date ? toDay(date) : now(), recurrence: null, categoryId: null })
      return personalToday(user)
    },
  }),

  completeTask: operation({
    name: 'complete_task',
    method: 'POST',
    path: '/personal/tasks/{id}/done',
    needs: 'WRITE',
    does: 'Ticks a Personal task as done today, or unticks it with "done": false.',
    input: z.object({ id: idField, done: z.boolean().default(true) }),
    run: async (user, { id, done }) => {
      await setTaskDone(user.id, id, done, now())
      return personalToday(user)
    },
  }),

  logSession: operation({
    name: 'log_session',
    method: 'POST',
    path: '/personal/sessions',
    needs: 'WRITE',
    does: 'Logs time already spent, ending now: "minutes", and optionally the "goalId" it counts for and a "note".',
    status: 201,
    input: z.object({
      minutes: z.number({ error: 'Give "minutes" as a number.' }).int('Give whole minutes.').min(1).max(960),
      goalId: idField.optional(),
      note: z.string().trim().max(200, 'Keep "note" under 200 characters.').optional(),
    }),
    run: async (user, { minutes, goalId, note }) => {
      await logSession(user.id, { minutes, goalId: goalId ?? null, note: note ?? null, endedAt: now() })
      return personalToday(user)
    },
  }),

  writeJournalEntry: operation({
    name: 'write_journal_entry',
    method: 'POST',
    path: '/personal/journal',
    needs: 'WRITE',
    does: 'Writes a journal entry for today: "text", and optionally "kind" (FREE, DAILY, DECISION, IDEA) and a "title".',
    status: 201,
    input: z.object({
      text: text('text', 10_000),
      kind: z.enum(['FREE', 'DAILY', 'DECISION', 'IDEA'], { error: 'Use FREE, DAILY, DECISION or IDEA for "kind".' }).default('FREE'),
      title: z.string().trim().max(80, 'Keep "title" under 80 characters.').optional(),
    }),
    run: async (user, { text: body, kind, title }) => {
      const entry = await createEntry(user.id, {
        type: kind,
        title: title || null,
        body,
        mood: null,
        energy: null,
        entryDate: now(),
        reviewOn: null,
        password: null,
      })
      return { id: entry.id }
    },
  }),
}
