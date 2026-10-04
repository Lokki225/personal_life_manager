import type { SeriesPeriod } from '@/domain/finance/series'

import type { ChartPoint } from './charts'

// Words for the time axis of a chart, in the reader's language (`locale` is an
// Intl tag such as "fr-FR"). A month has too many days to name them all, so
// it names one a week.
export function chartPoints(
  period: SeriesPeriod,
  buckets: { start: Date }[],
  values: (number | null)[],
  locale: string,
): ChartPoint[] {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
  const dayTitle = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })

  return buckets.map(({ start }, index) => ({
    label: period === 'year' ? month.format(start) : period === 'week' ? weekday.format(start) : String(start.getDate()),
    showLabel: period !== 'month' || (start.getDate() - 1) % 7 === 0,
    title: period === 'year' ? monthTitle.format(start) : dayTitle.format(start),
    value: values[index] ?? null,
  }))
}
