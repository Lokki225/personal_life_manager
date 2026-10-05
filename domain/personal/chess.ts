// chess.com ratings (first sync connector). Reading the public stats lives
// here, apart from the fetch, so a change in their format touches one place.

export const TIME_CONTROLS = ['rapid', 'blitz', 'bullet', 'daily'] as const
export type TimeControl = (typeof TIME_CONTROLS)[number]

// chess.com usernames: letters, digits, "_" and "-", 3 to 25 characters.
export const isChessUsername = (value: string) => /^[A-Za-z0-9_-]{3,25}$/.test(value)

// The current rating for a time control from /pub/player/{username}/stats, or
// null when the player has no rating there yet.
export function readRating(stats: unknown, timeControl: TimeControl): { rating: number; at: Date | null } | null {
  const block = (stats as Record<string, { last?: { rating?: unknown; date?: unknown } }> | null)?.[`chess_${timeControl}`]
  const rating = block?.last?.rating
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null
  const date = block?.last?.date
  return { rating, at: typeof date === 'number' ? new Date(date * 1000) : null }
}

// Whether a new value should be recorded: only when the rating moved.
export const ratingChanged = (latest: number | null, rating: number) => latest === null || latest !== rating
