'use client'

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { useT } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// One position on the time axis. `label` is the short axis text, shown only
// when `showLabel` is set, and `title` is the full wording for the tooltip.
export type ChartPoint = { label: string; showLabel: boolean; title: string; value: number | null }

// The top of the value axis: the next round number above the largest value.
function niceMax(value: number): number {
  if (value <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const leading = value / magnitude
  const step = leading <= 1 ? 1 : leading <= 2 ? 2 : leading <= 5 ? 5 : 10

  return step * magnitude
}

// Moves the highlighted position with the pointer or the arrow keys.
function useActivePoint(count: number) {
  const [active, setActive] = useState<number | null>(null)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    const step = event.key === 'ArrowLeft' ? -1 : 1
    setActive((current) => Math.min(Math.max((current ?? (step > 0 ? -1 : count)) + step, 0), count - 1))
  }

  // The pointer only has to be in a column, not on its mark.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const index = Math.floor(((event.clientX - bounds.left) / bounds.width) * count)
    setActive(Math.min(Math.max(index, 0), count - 1))
  }

  return { active, setActive, onKeyDown, onPointerMove }
}

function Frame({
  points,
  max,
  label,
  unit = CURRENCY_CODE,
  active,
  handlers,
  children,
}: {
  points: ChartPoint[]
  max: number
  label: string
  // What the values count. Money unless said otherwise.
  unit?: string
  active: number | null
  handlers: ReturnType<typeof useActivePoint>
  children: ReactNode
}) {
  const t = useT()
  const compactFormatter = new Intl.NumberFormat(t.intl, { notation: 'compact', maximumFractionDigits: 1 })
  const point = active === null ? null : points[active]
  const position = active === null ? 0 : ((active + 0.5) / points.length) * 100

  return (
    <div>
      <div className="relative ml-10 h-40">
        {[0, 0.5, 1].map((share) => (
          <div
            key={share}
            className="pointer-events-none absolute inset-x-0 border-t border-border"
            style={{ bottom: `${share * 100}%` }}
          >
            <span className="absolute right-full mr-2 -translate-y-1/2 text-[10px] whitespace-nowrap tabular-nums text-muted-foreground">
              {compactFormatter.format(max * share)}
            </span>
          </div>
        ))}

        <div
          role="group"
          tabIndex={0}
          aria-label={`${label}. ${t('Use the left and right arrow keys to read each value.')}`}
          className="absolute inset-0 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onPointerMove={handlers.onPointerMove}
          onPointerLeave={() => handlers.setActive(null)}
          onKeyDown={handlers.onKeyDown}
          onBlur={() => handlers.setActive(null)}
        >
          {children}
        </div>

        {point && point.value !== null ? (
          <div
            role="status"
            className={cn(
              'pointer-events-none absolute top-0 z-10 rounded-lg border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-[var(--shadow-soft)]',
              position < 25 ? 'translate-x-0' : position > 75 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{ left: `${position}%` }}
          >
            <p className="text-sm font-semibold whitespace-nowrap tabular-nums">
              {t.amount(point.value)}
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">{unit}</span>
            </p>
            <p className="text-xs whitespace-nowrap text-muted-foreground">{point.title}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 ml-10 flex" aria-hidden="true">
        {points.map((entry, index) => (
          <span key={index} className="flex-1 text-center text-[10px] whitespace-nowrap text-muted-foreground">
            {entry.showLabel ? entry.label : null}
          </span>
        ))}
      </div>

      {/* The same figures for screen readers, which cannot hover. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((entry, index) =>
            entry.value === null ? null : (
              <tr key={index}>
                <th scope="row">{entry.title}</th>
                <td>
                  {t.amount(entry.value)} {unit}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

// Amounts per day or per month, as columns. `reference` draws a labelled
// line across the plot, used for the budget.
export function ColumnChart({
  points,
  label,
  reference,
  unit,
}: {
  points: ChartPoint[]
  label: string
  reference?: { value: number; label: string }
  unit?: string
}) {
  const handlers = useActivePoint(points.length)
  const max = niceMax(Math.max(...points.map((point) => point.value ?? 0), reference?.value ?? 0))

  return (
    <Frame points={points} max={max} label={label} unit={unit} active={handlers.active} handlers={handlers}>
      <div className="absolute inset-0 flex items-end">
        {points.map((point, index) => {
          const value = point.value ?? 0

          return (
            <div key={index} className="flex h-full flex-1 items-end justify-center px-px">
              {value > 0 ? (
                <div
                  className={cn(
                    'w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity',
                    handlers.active !== null && handlers.active !== index && 'opacity-40',
                  )}
                  style={{ height: `max(${(value / max) * 100}%, 2px)` }}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      {reference && reference.value > 0 ? (
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/60"
          style={{ bottom: `${(reference.value / max) * 100}%` }}
        >
          <span className="absolute right-0 bottom-0.5 rounded-sm bg-card/90 px-1 text-[10px] font-medium text-muted-foreground">
            {reference.label}
          </span>
        </div>
      ) : null}
    </Frame>
  )
}

// A balance over time, as a line over a light wash. Positions without a value
// (days that have not come yet) are left empty.
export function LineChart({ points, label }: { points: ChartPoint[]; label: string }) {
  const handlers = useActivePoint(points.length)
  const max = niceMax(Math.max(...points.map((point) => point.value ?? 0)))
  const known = points
    .map((point, index) => ({ x: ((index + 0.5) / points.length) * 100, value: point.value, index }))
    .filter((point): point is { x: number; value: number; index: number } => point.value !== null)
  const y = (value: number) => 100 - (Math.max(value, 0) / max) * 100
  const line = known.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${y(point.value)}`).join(' ')
  const last = known.at(-1)
  const marked = known.find((point) => point.index === handlers.active) ?? last

  return (
    <Frame points={points} max={max} label={label} active={handlers.active} handlers={handlers}>
      {known.length > 0 ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full text-primary" aria-hidden="true">
          <path d={`${line} L${known.at(-1)!.x} 100 L${known[0].x} 100 Z`} fill="currentColor" opacity={0.1} />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      {handlers.active !== null && marked?.index === handlers.active ? (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${marked.x}%` }} />
      ) : null}

      {marked ? (
        <span
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
          style={{ left: `${marked.x}%`, top: `${y(marked.value)}%` }}
        />
      ) : null}
    </Frame>
  )
}
