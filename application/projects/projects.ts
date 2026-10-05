import {
  activityTrend,
  checkLinks,
  checkProject,
  checkStatusMove,
  countsFor,
  hoursPerWeek,
  latest,
  moneySummary,
  momentum,
  ProjectRuleError,
  uniqueSlug,
  type ProjectInput,
  type ProjectLinkInput,
  type ProjectStatus,
} from '../../domain/projects/projects'
import { projectRepository, type ProjectRepository } from '../../infrastructure/repositories/projectRepository'
import { now as clockNow } from '../../lib/clock'

type Deps = ProjectRepository
type Activity = Awaited<ReturnType<Deps['activity']>>

// What a project's activity says, from everything that already happens:
// last activity, momentum, the 14-day trend, hours, money.
function signals(project: { id: string; status: ProjectStatus; statusChangedAt: Date }, activity: Activity, now: Date) {
  const sessions = activity.sessions.filter((s) => countsFor(s, project.id))
  const devlog = activity.devlog.filter((d) => d.projectId === project.id).map((d) => d.at)
  const completions = activity.completions.filter((c) => c.projectId === project.id).map((c) => c.at)
  const releases = activity.releases.filter((r) => r.projectId === project.id).map((r) => r.at)
  const money = activity.money.filter((m) => m.projectId === project.id)

  const lastActivityAt = latest([
    project.statusChangedAt,
    ...sessions.map((s) => s.startedAt),
    ...devlog,
    ...completions,
    ...releases,
    ...money.map((m) => m.date),
  ])

  return {
    lastActivityAt,
    momentum: momentum(project.status, lastActivityAt, now),
    trend: activityTrend([...sessions.map((s) => s.startedAt), ...devlog, ...completions], now),
    hours: Math.round((sessions.reduce((sum, s) => sum + s.durationMin, 0) / 60) * 10) / 10,
    sessions,
    money: moneySummary(money),
  }
}

// Every project, from every node, with its momentum.
export async function listProjects(userId: string, now: Date = clockNow(), deps: Deps = projectRepository) {
  const [projects, activity] = await Promise.all([deps.list(userId), deps.activity(userId)])
  return projects.map((project) => {
    const s = signals(project, activity, now)
    return { ...project, lastActivityAt: s.lastActivityAt, momentum: s.momentum, trend: s.trend, hours: s.hours }
  })
}

export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number]

// One project and everything its page shows.
export async function getProject(userId: string, id: string, now: Date = clockNow(), deps: Deps = projectRepository) {
  const project = await deps.get(userId, id)
  if (!project) return null
  const [activity, goals, finance, sessions] = await Promise.all([
    deps.activity(userId),
    deps.goalsOf(userId, id),
    deps.financeRecords(userId, id),
    deps.sessionsOf(userId, id),
  ])
  const s = signals(project, activity, now)

  return {
    ...project,
    lastActivityAt: s.lastActivityAt,
    momentum: s.momentum,
    trend: s.trend,
    hours: s.hours,
    weeks: hoursPerWeek(s.sessions, now),
    money: s.money,
    goals,
    finance,
    sessions: sessions.map((x) => ({ id: x.id, startedAt: x.startedAt, minutes: x.durationMin ?? 0, note: x.note, goal: x.goal?.name ?? null })),
  }
}

export type ProjectPage = NonNullable<Awaited<ReturnType<typeof getProject>>>

async function checkArea(userId: string, lifeAreaId: string | null, deps: Deps) {
  if (lifeAreaId && !(await deps.ownsArea(userId, lifeAreaId))) throw new ProjectRuleError('Choose one of your areas.', 'lifeAreaId')
}

export async function createProject(
  userId: string,
  input: ProjectInput & { status?: ProjectStatus },
  links: ProjectLinkInput[],
  now: Date = clockNow(),
  deps: Deps = projectRepository,
) {
  const { status = 'ACTIVE', ...rest } = input
  const data = checkProject(rest)
  const checkedLinks = checkLinks(links)
  await checkArea(userId, data.lifeAreaId, deps)
  if (status !== 'PLANNING' && status !== 'ACTIVE') throw new ProjectRuleError('A new project is planned or active.', 'status')
  return deps.create(userId, data, checkedLinks, uniqueSlug(data.name, await deps.slugs(userId)), status, now)
}

export async function updateProject(userId: string, id: string, input: ProjectInput, links: ProjectLinkInput[], deps: Deps = projectRepository) {
  const data = checkProject(input)
  const checkedLinks = checkLinks(links)
  await checkArea(userId, data.lifeAreaId, deps)
  if (!(await deps.update(userId, id, data, checkedLinks))) throw new ProjectRuleError('This project no longer exists.')
}

export async function moveProject(userId: string, id: string, to: ProjectStatus, reason: string | null, now: Date = clockNow(), deps: Deps = projectRepository) {
  const move = checkStatusMove(to, reason)
  if (!(await deps.setStatus(userId, id, move.to, move.reason, now))) throw new ProjectRuleError('This project no longer exists.')
}
