// Projects (projects spec): bodies of work that evolve over time, tracked,
// not managed. Pure rules: fields, status moves, momentum, time and money.

export class ProjectRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ProjectRuleError'
    this.field = field
  }
}

export const isProjectRuleError = (error: unknown): error is ProjectRuleError => error instanceof ProjectRuleError

export const PROJECT_KINDS = ['SOFTWARE', 'MUSIC', 'WRITING', 'TRAINING', 'DESIGN', 'BUSINESS', 'OTHER'] as const
export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'PAUSED', 'SHIPPED', 'MAINTAINED', 'ARCHIVED'] as const
export const PROJECT_DOMAINS = ['personal', 'career'] as const
export type ProjectKind = (typeof PROJECT_KINDS)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectDomain = (typeof PROJECT_DOMAINS)[number]

export const MAX_LINKS = 8

export type ProjectInput = {
  name: string
  summary: string | null
  kind: ProjectKind
  primaryDomain: ProjectDomain
  lifeAreaId: string | null
  startedAt: Date | null
}

export type ProjectLinkInput = { label: string; url: string }

export function checkProject(input: ProjectInput): ProjectInput {
  const name = input.name.trim()
  if (!name) throw new ProjectRuleError('Name the project.', 'name')
  if (name.length > 80) throw new ProjectRuleError('Keep it under 80 characters.', 'name')
  const summary = input.summary?.trim() || null
  if (summary && summary.length > 300) throw new ProjectRuleError('Keep it to one or two sentences.', 'summary')
  if (!(PROJECT_KINDS as readonly string[]).includes(input.kind)) throw new ProjectRuleError('Choose what kind of work it is.', 'kind')
  if (!(PROJECT_DOMAINS as readonly string[]).includes(input.primaryDomain)) throw new ProjectRuleError('Choose Personal or Career.', 'primaryDomain')
  return { ...input, name, summary }
}

// Links to where the work lives: http or https only, never a script.
export function checkLinks(links: ProjectLinkInput[]): ProjectLinkInput[] {
  const kept = links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => l.label || l.url)
  if (kept.length > MAX_LINKS) throw new ProjectRuleError('Eight links at most.', 'links')
  return kept.map((link) => {
    if (!link.label) throw new ProjectRuleError('Give each link a label.', 'links')
    if (link.label.length > 40) throw new ProjectRuleError('Keep each label under 40 characters.', 'links')
    let parsed: URL
    try {
      parsed = new URL(link.url)
    } catch {
      throw new ProjectRuleError('Enter full links, starting with https://', 'links')
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new ProjectRuleError('Enter full links, starting with https://', 'links')
    if (link.url.length > 2000) throw new ProjectRuleError('This link is too long.', 'links')
    return { label: link.label, url: parsed.toString() }
  })
}

// A URL name for the project, from its name: "OdO Core!" → "odo-core".
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return slug || 'project'
}

// The first free slug: "odo", then "odo-2", "odo-3"…
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name)
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

// Moves are free in any direction; archiving says why.
export function checkStatusMove(to: ProjectStatus, reason: string | null): { to: ProjectStatus; reason: string | null } {
  if (!(PROJECT_STATUSES as readonly string[]).includes(to)) throw new ProjectRuleError('Choose a status.', 'status')
  const text = reason?.trim() || null
  if (to === 'ARCHIVED' && !text) throw new ProjectRuleError('Say why: archiving is a result, not a failure.', 'reason')
  if (text && text.length > 280) throw new ProjectRuleError('Keep it under 280 characters.', 'reason')
  return { to, reason: to === 'ARCHIVED' ? text : null }
}

const DAY = 86_400_000
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const daysSince = (date: Date, now: Date) => Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY)

export type Momentum =
  | { kind: 'paused' | 'archived' | 'none' }
  | { kind: 'active' }
  | { kind: 'recent'; days: number }
  | { kind: 'quiet'; days: number }

// Described, never judged (spec §6.6): "Active this week", "Quiet for N days"
// from 21 days, "Paused" and "Archived" from the status.
export function momentum(status: ProjectStatus, lastActivityAt: Date | null, now: Date): Momentum {
  if (status === 'PAUSED') return { kind: 'paused' }
  if (status === 'ARCHIVED') return { kind: 'archived' }
  if (!lastActivityAt) return { kind: 'none' }
  const days = daysSince(lastActivityAt, now)
  if (days <= 7) return { kind: 'active' }
  if (days >= 21) return { kind: 'quiet', days }
  return { kind: 'recent', days }
}

// The latest of the dates a project shows activity at.
export const latest = (dates: (Date | null | undefined)[]): Date | null =>
  dates.reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null)

// Activity in the last 14 days against the 14 before (sessions, devlog
// entries, completed tasks).
export function activityTrend(dates: Date[], now: Date) {
  const today = startOfDay(now).getTime()
  const recent = dates.filter((d) => today - startOfDay(d).getTime() < 14 * DAY && d <= now).length
  const previous = dates.filter((d) => {
    const age = today - startOfDay(d).getTime()
    return age >= 14 * DAY && age < 28 * DAY
  }).length
  return { recent, previous }
}

export type SessionForTime = { id: string; projectId: string | null; goalId: string | null; startedAt: Date; durationMin: number }

// The sessions that count for a project: linked to it, or to one of its
// goals. Each counts once, whichever way it is linked (scenario 4).
export function projectSessions<S extends SessionForTime>(sessions: S[], projectId: string, projectGoalIds: ReadonlySet<string>): S[] {
  return sessions.filter((s) => s.projectId === projectId || (s.goalId !== null && projectGoalIds.has(s.goalId)))
}

// Whether a session counts for a project: linked to it, or through its goal.
export const countsFor = (session: { projectId: string | null; goalProjectId: string | null }, projectId: string) =>
  session.projectId === projectId || session.goalProjectId === projectId

// Hours per week, Monday to Sunday, oldest first, from the first session's
// week to now; empty weeks included.
export function hoursPerWeek(sessions: SessionForTime[], now: Date): { week: Date; hours: number }[] {
  if (sessions.length === 0) return []
  const monday = (date: Date) => {
    const d = startOfDay(date)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  }
  const totals = new Map<number, number>()
  for (const s of sessions) totals.set(monday(s.startedAt).getTime(), (totals.get(monday(s.startedAt).getTime()) ?? 0) + s.durationMin)
  const first = Math.min(...totals.keys())
  const weeks: { week: Date; hours: number }[] = []
  for (let w = new Date(first); w <= monday(now); w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
    weeks.push({ week: w, hours: Math.round(((totals.get(w.getTime()) ?? 0) / 60) * 10) / 10 })
  }
  return weeks
}

export type MoneyLine = { date: Date; amount: number; flow: 'spent' | 'earned' }

// Spent, earned and net, in total and per month (newest month first).
// Never publishable (portfolio §4.1).
export function moneySummary(lines: MoneyLine[]) {
  const months = new Map<string, { month: Date; spent: number; earned: number }>()
  let spent = 0
  let earned = 0
  for (const line of lines) {
    const key = `${line.date.getFullYear()}-${line.date.getMonth()}`
    const row = months.get(key) ?? { month: new Date(line.date.getFullYear(), line.date.getMonth(), 1), spent: 0, earned: 0 }
    if (line.flow === 'spent') {
      row.spent += line.amount
      spent += line.amount
    } else {
      row.earned += line.amount
      earned += line.amount
    }
    months.set(key, row)
  }
  return {
    spent,
    earned,
    net: earned - spent,
    months: [...months.values()].sort((a, b) => b.month.getTime() - a.month.getTime()).map((m) => ({ ...m, net: m.earned - m.spent })),
  }
}
