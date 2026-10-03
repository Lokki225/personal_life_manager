'use client'

import { CURRENCY_CODE } from '@/domain/finance/calculations'
import { useT } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

// An amount with a quiet currency code, e.g. "60,000 XOF".
export function Money({
  value,
  sign,
  className,
}: {
  value: number
  // Prefix for outgoing amounts, e.g. "-".
  sign?: string
  className?: string
}) {
  const t = useT()

  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {sign}
      {t.amount(value)}
      <span className="ml-1 text-[max(0.65em,0.6875rem)] font-medium text-muted-foreground">{CURRENCY_CODE}</span>
    </span>
  )
}

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
  tone?: 'primary' | 'success' | 'warning' | 'danger'
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
