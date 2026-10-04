// Sessions and metric series: small rules, no database.

// Whole minutes between start and end, at least one for a session that ran.
export function sessionMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000), 1)
}

// A session can be logged afterwards for up to 16 hours.
export const MAX_SESSION_MINUTES = 16 * 60

// A stable key for a series from its label: "Chess rapid" → "chess_rapid",
// with a number when the key is taken.
export function seriesKey(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'series'

  let key = base
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`
  return key
}
