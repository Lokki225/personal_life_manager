import { describe, expect, it, vi } from 'vitest'

import { abandonGoal, addGoalTask, createPersonalGoal } from './goals'
import { logSession, startSession, stopSession } from './sessions'

const now = new Date(2026, 9, 7, 10)

function deps(overrides: Record<string, unknown> = {}) {
  return {
    listCategories: async () => [{ id: 'cat', name: 'Mind' }],
    listSeries: vi.fn(async () => [{ id: 'elo', key: 'chess_rapid', label: 'Chess rapid', unit: null }]),
    createSeries: vi.fn(async (_u: string, data: { key: string; label: string; unit: string | null }) => ({ id: 'new-series', ...data })),
    addEntry: vi.fn(async () => true),
    createFromPlan: vi.fn(async () => ({ id: 'g' })),
    getTree: vi.fn(async (_u: string, id: string) =>
      id === 'g' ? { id: 'g', name: 'Learn Japanese', tree: { milestones: [{ id: 'm0' }], groups: [] } } : null,
    ),
    createTask: vi.fn(async (_u: string, data: object) => ({ id: 't', ...data })),
    abandon: vi.fn(async () => true),
    getRunningSession: vi.fn(async () => null),
    createSession: vi.fn(async () => ({ id: 's' })),
    finishSession: vi.fn(async () => true),
    ...overrides,
  } as never
}

const base = { name: 'Reach 1800 rapid', horizon: 'YEAR' as const, deadline: null, categoryId: null }

describe('createPersonalGoal', () => {
  it('creates an outcome goal on a new measure, with today’s value', async () => {
    const d = deps() as unknown as Record<string, ReturnType<typeof vi.fn>>

    await createPersonalGoal(
      'u',
      { ...base, preset: 'outcome', newSeries: { label: 'Chess blitz', unit: null }, currentValue: 1543, target: 1800 },
      now,
      d as never,
    )

    expect(d.createSeries).toHaveBeenCalledWith('u', { key: 'chess_blitz', label: 'Chess blitz', unit: null })
    expect(d.addEntry).toHaveBeenCalledWith('u', 'new-series', 1543, now)
    const plan = d.createFromPlan.mock.calls[0][1]
    expect(plan.groups[0].conditions[0]).toMatchObject({ source: 'METRIC_SERIES', sourceRef: { seriesId: 'new-series' }, target: 1800 })
    expect(plan).toMatchObject({ domain: 'personal', lifecycle: 'TERMINAL', latch: true })
  })

  it('adds weekly sessions as a health check, and keeps habit tiers in order', async () => {
    const d = deps() as unknown as Record<string, ReturnType<typeof vi.fn>>

    await createPersonalGoal('u', { ...base, preset: 'accumulation', target: 150, weeklySessions: 4 }, now, d as never)
    expect(d.createFromPlan.mock.calls[0][1].groups.map((g: { role: string }) => g.role)).toEqual(['COMPLETION', 'HEALTH'])

    await createPersonalGoal('u', { ...base, preset: 'habit', target: 5, floor: 6, stretch: 7 }, now, d as never)
    expect(d.createFromPlan.mock.calls[1][1].groups[0].conditions[0]).toMatchObject({ floor: null, stretch: 7 })
  })

  it('points at what is missing', async () => {
    const attempt = (input: object) => createPersonalGoal('u', { ...base, preset: 'outcome', ...input } as never, now, deps())

    await expect(attempt({ name: ' ' })).rejects.toMatchObject({ field: 'name' })
    await expect(attempt({ target: 1800 })).rejects.toMatchObject({ field: 'seriesId' })
    await expect(attempt({ seriesId: 'elo' })).rejects.toMatchObject({ field: 'target' })
    await expect(attempt({ seriesId: 'other', target: 1 })).rejects.toMatchObject({ field: 'seriesId' })
    await expect(attempt({ seriesId: 'elo', target: 1, deadline: new Date(2026, 9, 6) })).rejects.toMatchObject({ field: 'deadline' })
    await expect(attempt({ preset: 'milestones', milestones: [' '] })).rejects.toMatchObject({ field: 'milestones' })
  })
})

describe('goal tasks and abandoning', () => {
  it('attaches a task to the goal or to one of its steps', async () => {
    const d = deps() as unknown as Record<string, ReturnType<typeof vi.fn>>
    const task = { title: 'Learn 20 kana', dueDate: null, recurrence: null, categoryId: null }

    await addGoalTask('u', 'g', task, d as never)
    await addGoalTask('u', 'g', { ...task, milestoneId: 'm0' }, d as never)

    expect(d.createTask.mock.calls[0][1]).toMatchObject({ goalId: 'g', milestoneId: null })
    expect(d.createTask.mock.calls[1][1]).toMatchObject({ goalId: null, milestoneId: 'm0' })
    await expect(addGoalTask('u', 'g', { ...task, milestoneId: 'elsewhere' }, d as never)).rejects.toMatchObject({ field: 'milestoneId' })
    await expect(addGoalTask('u', 'nope', task, d as never)).rejects.toThrow('This goal no longer exists.')
  })

  it('keeps the reason for abandoning, and writes it in the journal linked to the goal', async () => {
    const d = deps() as unknown as Record<string, ReturnType<typeof vi.fn>>
    const journal = { ownedTargets: async () => new Set(['goal:g']), createEntry: vi.fn(async () => ({ id: 'e' })) }

    await abandonGoal('u', 'g', '  Changed priorities ', now, d as never, journal as never)
    expect(d.abandon).toHaveBeenCalledWith('u', 'g', 'Changed priorities', now)
    expect(journal.createEntry).toHaveBeenCalledWith(
      'u',
      expect.objectContaining({ type: 'DECISION', title: 'Learn Japanese', body: 'Changed priorities\n\n@[Learn Japanese](goal:g)' }),
      [{ targetType: 'goal', targetId: 'g', label: 'Learn Japanese' }],
      null,
    )

    await abandonGoal('u', 'g', null, now, d as never, journal as never)
    expect(journal.createEntry).toHaveBeenCalledTimes(1)
  })
})

describe('sessions', () => {
  it('runs one session at a time, for one of the user’s goals', async () => {
    await expect(startSession('u', null, now, deps({ getRunningSession: async () => ({ id: 'r' }) }))).rejects.toThrow(
      'A session is already running. Stop it first.',
    )
    await expect(startSession('u', 'nope', now, deps())).rejects.toMatchObject({ field: 'goalId' })
  })

  it('stops a session with its minutes, capped for one left running for days', async () => {
    const finishSession = vi.fn(async () => true)
    await stopSession('u', ' Good one ', now, deps({ getRunningSession: async () => ({ id: 'r', startedAt: new Date(2026, 9, 7, 9, 15) }), finishSession }))
    await stopSession('u', null, now, deps({ getRunningSession: async () => ({ id: 'r', startedAt: new Date(2026, 9, 1) }), finishSession }))

    expect(finishSession).toHaveBeenNthCalledWith(1, 'u', 'r', now, 45, 'Good one')
    expect(finishSession).toHaveBeenNthCalledWith(2, 'u', 'r', now, 960, null)
  })

  it('logs a past session ending when it says', async () => {
    const createSession = vi.fn(async () => ({ id: 's' }))
    await logSession('u', { minutes: 30, goalId: null, note: null, endedAt: now }, deps({ createSession }))

    expect(createSession).toHaveBeenCalledWith('u', { goalId: null, startedAt: new Date(2026, 9, 7, 9, 30), endedAt: now, durationMin: 30, note: null })
    await expect(logSession('u', { minutes: 0, goalId: null, note: null, endedAt: now }, deps())).rejects.toMatchObject({ field: 'minutes' })
  })
})
