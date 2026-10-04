import type { ConditionResult } from '@/domain/goals/engine'
import type { Translator } from '@/lib/i18n/translate'

// How a goal's numbers read: hours, a share, a count this week, a value.
export function conditionLine(t: Translator, result: ConditionResult, unit?: string | null) {
  const c = result.condition
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 })
  const withUnit = (value: number) => (unit ? `${number.format(value)} ${unit}` : number.format(value))

  if (c.aggregation === 'RATIO') {
    return t('{percent}% done', { percent: Math.round(result.actual * 100) })
  }
  if (c.source === 'SESSIONS' && c.sourceRef.measure === 'hours') {
    return t('{actual} of {target} hours', { actual: number.format(result.actual), target: number.format(c.target) })
  }
  if (c.window.type === 'CALENDAR' && c.window.unit === 'week') {
    return c.source === 'TASKS'
      ? t('{actual} of {target} tasks this week', { actual: result.actual, target: c.target })
      : t('{actual} of {target} sessions this week', { actual: result.actual, target: c.target })
  }
  return t('{actual}, aiming for {target}', { actual: withUnit(result.actual), target: withUnit(c.target) })
}

// The values of a measure over time, as a small line.
export function MetricChart({ entries, target, label }: { entries: { value: number; recordedAt: Date }[]; target: number | null; label: string }) {
  if (entries.length < 2) return null

  const width = 320
  const height = 96
  const pad = 6
  const values = entries.map((e) => e.value)
  const low = Math.min(...values, target ?? Infinity)
  const high = Math.max(...values, target ?? -Infinity)
  const span = high - low || 1
  const first = entries[0].recordedAt.getTime()
  const time = entries.at(-1)!.recordedAt.getTime() - first || 1
  const x = (date: Date) => pad + ((date.getTime() - first) / time) * (width - pad * 2)
  const y = (value: number) => height - pad - ((value - low) / span) * (height - pad * 2)
  const path = entries.map((e, i) => `${i === 0 ? 'M' : 'L'}${x(e.recordedAt).toFixed(1)} ${y(e.value).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-24 w-full">
      {target !== null ? (
        <line x1={pad} x2={width - pad} y1={y(target)} y2={y(target)} className="stroke-muted-foreground" strokeDasharray="4 4" strokeWidth={1} />
      ) : null}
      <path d={path} fill="none" className="stroke-node-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(entries.at(-1)!.recordedAt)} cy={y(entries.at(-1)!.value)} r={4} className="fill-node-accent" />
    </svg>
  )
}
