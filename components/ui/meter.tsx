import { cn } from '@/lib/utils'

// A horizontal gauge. `marker` draws a tick at that percentage, used for the
// "where you should be today" pace line.
export function Meter({
  value,
  tone = 'primary',
  marker,
  label,
  className,
}: {
  value: number
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'node'
  marker?: number
  label: string
  className?: string
}) {
  const clamp = (percent: number) => Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100)
  const fill = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    // The accent of the node being shown.
    node: 'bg-node-accent',
  }[tone]

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(value))}
      className={cn('relative h-2.5 w-full rounded-full bg-muted', className)}
    >
      <div
        className={cn('animate-fill h-full origin-left rounded-full transition-[width] duration-500', fill)}
        style={{ width: `${clamp(value)}%` }}
      />
      {marker === undefined ? null : (
        <span
          className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-foreground"
          style={{ left: `calc(${clamp(marker)}% - 1px)` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
