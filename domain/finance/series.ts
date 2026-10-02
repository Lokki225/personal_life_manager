// Time series for charts: a period cut into buckets, and amounts placed in them.

export type SeriesPeriod = 'week' | 'month' | 'year'

export type Bucket = { start: Date; end: Date }

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

// A week is seven days from Monday, a month is its days, a year is its months.
export function periodBuckets(period: SeriesPeriod, referenceDate: Date): Bucket[] {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => ({
      start: new Date(year, index, 1),
      end: endOfDay(new Date(year, index + 1, 0)),
    }))
  }

  const day = (date: Date) => ({ start: date, end: endOfDay(date) })

  if (period === 'week') {
    const monday = referenceDate.getDate() - ((referenceDate.getDay() + 6) % 7)

    return Array.from({ length: 7 }, (_, index) => day(new Date(year, month, monday + index)))
  }

  const days = new Date(year, month + 1, 0).getDate()

  return Array.from({ length: days }, (_, index) => day(new Date(year, month, index + 1)))
}

// The total of the entries that fall in each bucket.
export function sumByBucket(buckets: Bucket[], entries: { date: Date; amount: number }[]): number[] {
  return buckets.map((bucket) =>
    entries
      .filter((entry) => entry.date >= bucket.start && entry.date <= bucket.end)
      .reduce((total, entry) => total + entry.amount, 0),
  )
}

// The balance at the end of each bucket, counting everything before the
// period too. A bucket that has not started yet has no balance: null.
export function runningBalance(
  buckets: Bucket[],
  entries: { date: Date; amount: number }[],
  referenceDate: Date,
): (number | null)[] {
  return buckets.map((bucket) =>
    bucket.start > referenceDate
      ? null
      : entries.filter((entry) => entry.date <= bucket.end).reduce((total, entry) => total + entry.amount, 0),
  )
}
