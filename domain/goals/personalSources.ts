import type { Resolve } from './engine'

// The Personal measurement sources, over data loaded beforehand. A source
// that says { goal: 'self' } reads the goal being evaluated.

export type PersonalEvidence = {
  tasks: { id: string; goalId: string | null; milestoneId: string | null; createdAt: Date; done: boolean }[]
  completions: { taskId: string; occurrenceDate: Date }[]
  // Finished sessions only; a running one does not count yet.
  sessions: { goalId: string | null; startedAt: Date; durationMin: number }[]
  entries: { seriesId: string; value: number; recordedAt: Date }[]
  milestones: { id: string; goalId: string; createdAt?: Date; completedAt: Date | null }[]
}

type Scope = { goalId: string; milestoneId?: string | null }

const goalOf = (ref: Record<string, unknown>, scope: Scope) =>
  ref.goal === 'self' ? scope.goalId : typeof ref.goalId === 'string' ? ref.goalId : null

// The tasks a condition is about: those of the milestone it belongs to, or of
// the goal.
function scopedTasks(evidence: PersonalEvidence, ref: Record<string, unknown>, scope: Scope) {
  if (scope.milestoneId) return evidence.tasks.filter((t) => t.milestoneId === scope.milestoneId)
  const goalId = goalOf(ref, scope)
  return evidence.tasks.filter((t) => t.goalId === goalId)
}

export function personalResolver(evidence: PersonalEvidence, scope: Scope, now: Date): Resolve {
  return (condition) => {
    const ref = condition.sourceRef

    switch (condition.source) {
      case 'TASKS': {
        const tasks = scopedTasks(evidence, ref, scope)
        // A checklist: one point per task, done or not.
        if (condition.aggregation === 'RATIO') {
          return tasks.map((t) => ({ at: t.createdAt, value: t.done ? 1 : 0 }))
        }
        const ids = new Set(tasks.map((t) => t.id))
        return evidence.completions.filter((c) => ids.has(c.taskId)).map((c) => ({ at: c.occurrenceDate, value: 1 }))
      }
      case 'SESSIONS': {
        const goalId = goalOf(ref, scope)
        const value = (minutes: number) => (ref.measure === 'hours' ? minutes / 60 : ref.measure === 'minutes' ? minutes : 1)
        return evidence.sessions.filter((s) => s.goalId === goalId).map((s) => ({ at: s.startedAt, value: value(s.durationMin) }))
      }
      case 'METRIC_SERIES':
        return evidence.entries.filter((e) => e.seriesId === ref.seriesId).map((e) => ({ at: e.recordedAt, value: e.value }))
      case 'MILESTONES': {
        const goalId = goalOf(ref, scope)
        return evidence.milestones
          .filter((m) => m.goalId === goalId)
          .map((m) => ({ at: m.completedAt ?? now, value: m.completedAt ? 1 : 0 }))
      }
      default:
        throw new Error(`No measurement source for ${condition.source}`)
    }
  }
}

// Whether anything has happened for a goal yet.
export function hasEvidence(evidence: PersonalEvidence, goalId: string, seriesIds: string[]): boolean {
  const taskIds = new Set(evidence.tasks.filter((t) => t.goalId === goalId).map((t) => t.id))
  return (
    evidence.sessions.some((s) => s.goalId === goalId) ||
    evidence.completions.some((c) => taskIds.has(c.taskId)) ||
    evidence.entries.some((e) => seriesIds.includes(e.seriesId)) ||
    evidence.milestones.some((m) => m.goalId === goalId && m.completedAt)
  )
}

