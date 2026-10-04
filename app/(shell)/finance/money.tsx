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

// Shared with the other nodes; still exported from here for Finance.
export { Meter } from '@/components/ui/meter'
