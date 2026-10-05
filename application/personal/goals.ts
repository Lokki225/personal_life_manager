import { evaluatePersonalGoal } from '../../domain/goals/personalGoal'
import {
  accumulationPreset,
  checklistPreset,
  habitPreset,
  milestonePreset,
  outcomePreset,
  presetOf,
  withWeeklySessions,
  type Horizon,
  type Preset,
} from '../../domain/goals/presets'
import type { TimeControl } from '../../domain/personal/chess'
import { PersonalRuleError } from '../../domain/personal/errors'
import { linkToken } from '../../domain/personal/journal'
import { addDays, parseRecurrence, startOfDay } from '../../domain/personal/tasks'
import { goalRepository, type StoredGoal } from '../../infrastructure/repositories/goalRepository'
import { journalRepository } from '../../infrastructure/repositories/journalRepository'
import { personalRepository } from '../../infrastructure/repositories/personalRepository'
import { now as clockNow } from '../../lib/clock'
import { addTask, type NewTask } from './tasks'
import { createEntry } from './journal'
import { createSeries, logMetric } from './sessions'
import { connectChess, getSyncStatus, syncIfStale } from './sync'

type Deps = typeof goalRepository & typeof personalRepository
const defaultDeps: Deps = { ...personalRepository, ...goalRepository }

export type NewGoal = {
  preset: Preset
  name: string
  horizon: Horizon
  deadline: Date | null
  categoryId: string | null
  // Outcome: an existing measure, or a new one, with where it stands today.
  seriesId?: string | null
  newSeries?: { label: string; unit: string | null } | null
  // Or a chess.com rating, synced from now on.
  chess?: { username: string; timeControl: TimeControl } | null
  currentValue?: number | null
  target?: number | null
  // Milestone path: the steps, in order.
  milestones?: string[]
  // Habit: how many a week, counted from sessions or ticked tasks.
  counts?: 'sessions' | 'tasks'
  floor?: number | null
  stretch?: number | null
  // A goal that ends can also ask for sessions every week.
  weeklySessions?: number | null
}

const positive = (value: number | null | undefined, field: string, message: string) => {
  if (value == null || !Number.isFinite(value) || value <= 0) throw new PersonalRuleError(message, field)
  return value
}

export async function createPersonalGoal(userId: string, input: NewGoal, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const name = input.name.trim()

  if (!name) throw new PersonalRuleError('Enter a goal name.', 'name')
  if (name.length > 60) throw new PersonalRuleError('Keep it under 60 characters.', 'name')
  if (input.deadline && input.deadline < startOfDay(now)) throw new PersonalRuleError('Choose a date from today on.', 'deadline')
  if (input.categoryId && !(await deps.listCategories(userId)).some((c) => c.id === input.categoryId)) {
    throw new PersonalRuleError('Choose one of your categories.', 'categoryId')
  }

  const common = { name, horizon: input.horizon, deadline: input.deadline, categoryId: input.categoryId }
  let plan

  switch (input.preset) {
    case 'outcome': {
      const target = positive(input.target, 'target', 'Enter the value to reach.')
      let seriesId = input.seriesId ?? null
      let unit: string | null = null

      if (input.chess) {
        // The rating comes from chess.com: today's is recorded on connecting.
        const connected = await connectChess(userId, input.chess, now)
        plan = outcomePreset({ ...common, seriesId: connected.seriesId, target, unit: null })
        break
      }

      if (seriesId) {
        const series = (await deps.listSeries(userId)).find((s) => s.id === seriesId)
        if (!series) throw new PersonalRuleError('Choose one of your measures.', 'seriesId')
        unit = series.unit
      } else if (input.newSeries) {
        const series = await createSeries(userId, input.newSeries, deps)
        seriesId = series.id
        unit = series.unit
      } else {
        throw new PersonalRuleError('Choose what you measure.', 'seriesId')
      }

      if (input.currentValue != null) {
        await logMetric(userId, seriesId, input.currentValue, now, deps)
      }
      plan = outcomePreset({ ...common, seriesId, target, unit })
      break
    }
    case 'accumulation':
      plan = accumulationPreset({ ...common, hours: positive(input.target, 'target', 'Enter a number of hours.') })
      break
    case 'milestones': {
      const steps = (input.milestones ?? []).map((m) => m.trim()).filter(Boolean)
      if (steps.length === 0) throw new PersonalRuleError('Add at least one step.', 'milestones')
      if (steps.length > 12) throw new PersonalRuleError('Up to 12 steps.', 'milestones')
      if (steps.some((s) => s.length > 60)) throw new PersonalRuleError('Keep each step under 60 characters.', 'milestones')
      plan = milestonePreset({ ...common, milestones: steps })
      break
    }
    case 'habit': {
      const perWeek = positive(input.target, 'target', 'Enter how many times a week.')
      if (perWeek > 50) throw new PersonalRuleError('Up to 50 times a week.', 'target')
      const floor = input.floor && input.floor < perWeek ? input.floor : null
      const stretch = input.stretch && input.stretch > perWeek ? input.stretch : null
      plan = habitPreset({ ...common, perWeek, counts: input.counts ?? 'sessions', floor, stretch })
      break
    }
    case 'checklist':
      plan = checklistPreset(common)
      break
  }

  return deps.createFromPlan(userId, withWeeklySessions(plan, input.weeklySessions ?? null))
}

const seriesOf = (goal: StoredGoal) =>
  goal.tree.groups.flatMap((g) => g.conditions).flatMap((c) => (typeof c.sourceRef.seriesId === 'string' ? [c.sourceRef.seriesId] : []))

// Evaluates goals, and records milestones done and goals achieved for the
// first time.
async function evaluateAll(userId: string, goals: StoredGoal[], now: Date, deps: Deps) {
  const evidence = await deps.loadEvidence(userId, goals.map((g) => g.id), goals.flatMap(seriesOf))
  const evaluated = goals.map((goal) => ({ goal, evaluation: evaluatePersonalGoal(goal.tree, evidence, now) }))

  await deps.stamp(
    evaluated.flatMap((e) => e.evaluation.stamp.milestoneIds),
    evaluated.filter((e) => e.evaluation.stamp.achieved).map((e) => e.goal.id),
    now,
  )

  return evaluated
}

export async function listPersonalGoals(userId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const goals = await deps.listTrees(userId, 'personal')
  const evaluated = await evaluateAll(userId, goals, now, deps)

  return evaluated.map(({ goal, evaluation }) => ({
    id: goal.id,
    name: goal.name,
    horizon: goal.horizon,
    category: goal.category,
    deadline: goal.tree.deadline,
    lifecycle: goal.tree.lifecycle,
    preset: evaluation.completion[0] ? presetOf(evaluation.completion[0].condition, goal.tree.lifecycle) : null,
    evaluation,
    // Goals that use sessions can be timed from Today.
    usesSessions: goal.tree.groups.some((g) => g.conditions.some((c) => c.source === 'SESSIONS')),
  }))
}

export type GoalSummary = Awaited<ReturnType<typeof listPersonalGoals>>[number]

// One goal with what its page shows: tasks, this week's sessions, and the
// values of its measure.
export async function getPersonalGoal(userId: string, goalId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const goal = await deps.getTree(userId, goalId, 'personal')
  if (!goal) return null

  // A synced measure catches up first when it has not synced for a while.
  const synced = seriesOf(goal)[0]
  if (synced) await syncIfStale(userId, synced, now)

  const [[{ evaluation }], tasks, sessions] = await Promise.all([
    evaluateAll(userId, [goal], now, deps),
    deps.listTasks(userId),
    deps.listSessions(userId, addDays(startOfDay(now), -6), addDays(startOfDay(now), 1)),
  ])
  const seriesId = seriesOf(goal)[0] ?? null
  const [series, entries, sync] = seriesId
    ? await Promise.all([
        deps.listSeries(userId).then((all) => all.find((s) => s.id === seriesId) ?? null),
        deps.listEntries(userId, seriesId),
        getSyncStatus(userId, seriesId),
      ])
    : [null, [], null]
  const milestoneIds = new Set(goal.tree.milestones.map((m) => m.id))

  return {
    id: goal.id,
    name: goal.name,
    horizon: goal.horizon,
    category: goal.category,
    tree: goal.tree,
    abandonReason: goal.abandonReason,
    careerRelevant: goal.careerRelevant,
    preset: evaluation.completion[0] ? presetOf(evaluation.completion[0].condition, goal.tree.lifecycle) : null,
    evaluation,
    tasks: tasks
      .filter((t) => t.goalId === goal.id || (t.milestoneId && milestoneIds.has(t.milestoneId)))
      .map((t) => ({ ...t, recurrence: parseRecurrence(t.recurrence) })),
    sessions: sessions.filter((s) => s.goal?.id === goal.id),
    series,
    sync,
    entries: entries.map((e) => ({ value: Number(e.value), recordedAt: e.recordedAt })),
  }
}

// A goal that counts for the career: once achieved, Career offers to add it
// as a skill.
export async function setCareerRelevant(userId: string, goalId: string, value: boolean, deps: Deps = defaultDeps) {
  if (!(await deps.setCareerRelevant(userId, goalId, value))) throw new PersonalRuleError('This goal no longer exists.')
}

// Abandoning is the only manual status. A reason given is also kept in the
// journal, as a decision linked to the goal.
export async function abandonGoal(
  userId: string,
  goalId: string,
  reason: string | null,
  now: Date = clockNow(),
  deps: Deps = defaultDeps,
  journal: typeof journalRepository = journalRepository,
) {
  const text = reason?.trim() || null
  if (text && text.length > 280) throw new PersonalRuleError('Keep it under 280 characters.', 'reason')

  const goal = await deps.getTree(userId, goalId, 'personal')
  if (!goal || !(await deps.abandon(userId, goalId, text, now))) throw new PersonalRuleError('This goal no longer exists.')

  if (text) {
    await createEntry(
      userId,
      {
        type: 'DECISION',
        title: goal.name,
        body: `${text}\n\n${linkToken({ targetType: 'goal', targetId: goal.id, label: goal.name })}`,
        mood: null,
        energy: null,
        entryDate: now,
        reviewOn: null,
        password: null,
      },
      journal,
    )
  }
}

export async function addMilestone(userId: string, goalId: string, name: string, deps: Deps = defaultDeps) {
  const text = name.trim()
  if (!text) throw new PersonalRuleError('Name the step.', 'name')
  if (text.length > 60) throw new PersonalRuleError('Keep it under 60 characters.', 'name')
  if (!(await deps.addMilestone(userId, goalId, text))) throw new PersonalRuleError('This goal no longer exists.')
}

// A task for a goal, or for one of its milestones.
export async function addGoalTask(
  userId: string,
  goalId: string,
  input: Omit<NewTask, 'goalId'>,
  deps: Deps = defaultDeps,
) {
  const goal = await deps.getTree(userId, goalId, 'personal')
  if (!goal) throw new PersonalRuleError('This goal no longer exists.')
  if (input.milestoneId && !goal.tree.milestones.some((m) => m.id === input.milestoneId)) {
    throw new PersonalRuleError('Choose one of this goal’s steps.', 'milestoneId')
  }

  return addTask(userId, { ...input, goalId: input.milestoneId ? null : goalId }, deps)
}

// Logs where an outcome goal's measure stands.
export async function logGoalValue(userId: string, goalId: string, value: number, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const goal = await deps.getTree(userId, goalId, 'personal')
  const seriesId = goal ? seriesOf(goal)[0] : null
  if (!seriesId) throw new PersonalRuleError('This goal has nothing to log.')
  await logMetric(userId, seriesId, value, now, deps)
}
