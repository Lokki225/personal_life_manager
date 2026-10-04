import type { Aggregation, Point } from './engine'

// When a goal will reach its target at the current pace (mechanism doc §4.3).
// Shown, never used to nag.

const DAY_MS = 86_400_000

// A level (a rating, a score) follows a trend; an accumulation (hours,
// sessions) follows its rate since the start.
export const paceKind = (aggregation: Aggregation): 'level' | 'cumulative' | null =>
  aggregation === 'LATEST' || aggregation === 'MAX'
    ? 'level'
    : aggregation === 'SUM' || aggregation === 'COUNT'
      ? 'cumulative'
      : null

// The date the target is reached at the current pace, or null when there is
// not enough to tell (or the pace goes the wrong way).
export function projectDate(
  points: Point[],
  target: number,
  kind: 'level' | 'cumulative',
  start: Date,
  now: Date,
): Date | null {
  if (kind === 'cumulative') {
    const total = points.reduce((sum, p) => sum + p.value, 0)
    if (total >= target) return now
    const days = Math.max((now.getTime() - start.getTime()) / DAY_MS, 1)
    const rate = total / days
    return rate > 0 ? new Date(now.getTime() + ((target - total) / rate) * DAY_MS) : null
  }

  // A straight line through the last 60 days.
  const recent = points
    .filter((p) => now.getTime() - p.at.getTime() <= 60 * DAY_MS && p.at <= now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  if (recent.length < 3) {
    return null
  }

  const current = recent.at(-1)!.value
  if (current >= target) return now

  const xs = recent.map((p) => p.at.getTime() / DAY_MS)
  const ys = recent.map((p) => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const spread = xs.reduce((s, x) => s + (x - mx) ** 2, 0)

  if (spread === 0) {
    return null
  }

  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / spread
  return slope > 0 ? new Date(now.getTime() + ((target - current) / slope) * DAY_MS) : null
}

// Where a value stands against floor / target / stretch. Reaching the floor
// already counts as a good week.
export function tierOf(actual: number, target: number, floor?: number | null, stretch?: number | null) {
  if (stretch != null && actual >= stretch) return 'stretch' as const
  if (actual >= target) return 'target' as const
  if (floor != null && actual >= floor) return 'floor' as const
  return 'below' as const
}
