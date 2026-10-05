import { isChessUsername, ratingChanged, type TimeControl } from '../../domain/personal/chess'
import { PersonalRuleError } from '../../domain/personal/errors'
import { seriesKey } from '../../domain/personal/sessions'
import { ChessComError, fetchChessRating } from '../../infrastructure/connectors/chesscom'
import { personalRepository } from '../../infrastructure/repositories/personalRepository'
import { syncRepository, type Connector } from '../../infrastructure/repositories/syncRepository'
import { now as clockNow, withClockZone } from '../../lib/clock'

// Measures filled from outside: a chess.com rating, synced once a day by the
// daily job, when a goal page is opened and has not synced for a while, and
// on demand. A failed sync never breaks a goal: the last value stays.

type Deps = Pick<typeof syncRepository, 'createConnector' | 'forSeries' | 'recordSuccess' | 'recordFailure' | 'listAll'> &
  Pick<typeof personalRepository, 'listSeries'> & { fetchRating: typeof fetchChessRating }

const defaultDeps: Deps = { ...syncRepository, listSeries: personalRepository.listSeries, fetchRating: fetchChessRating }

const STALE_AFTER_MS = 12 * 60 * 60 * 1000

const friendly = (error: unknown) =>
  error instanceof ChessComError
    ? error.reason === 'unknown_player'
      ? 'No chess.com player has this username.'
      : error.reason === 'no_rating'
        ? 'This player has no rating in that time control yet.'
        : 'chess.com could not be reached. Try again in a moment.'
    : 'chess.com could not be reached. Try again in a moment.'

// Checks the account, then creates the connector and its measure with today's
// rating. Returns the measure, for an outcome goal to follow.
export async function connectChess(
  userId: string,
  input: { username: string; timeControl: TimeControl },
  now: Date = clockNow(),
  deps: Deps = defaultDeps,
) {
  const username = input.username.trim()
  if (!isChessUsername(username)) throw new PersonalRuleError('Enter a chess.com username.', 'chessUsername')

  let rating
  try {
    rating = await deps.fetchRating(username, input.timeControl)
  } catch (error) {
    throw new PersonalRuleError(friendly(error), 'chessUsername')
  }

  const label = `chess.com ${input.timeControl} (${username})`
  const taken = (await deps.listSeries(userId)).map((series) => series.key)

  return deps.createConnector(userId, {
    provider: 'chess.com',
    accountRef: username,
    timeControl: input.timeControl,
    series: { key: seriesKey(label, taken), label },
    first: { value: rating.rating, at: now },
  })
}

// Syncs one connector. Never throws: a failure is kept on the connector.
export async function syncConnector(connector: Connector, now: Date, deps: Deps = defaultDeps): Promise<'updated' | 'unchanged' | 'failed'> {
  if (!connector.seriesId) return 'unchanged'

  try {
    const { rating } = await deps.fetchRating(connector.accountRef, connector.timeControl as TimeControl)
    const changed = ratingChanged(connector.latest, rating)
    await deps.recordSuccess(connector.id, now, changed ? { seriesId: connector.seriesId, value: rating, source: connector.provider } : null)
    return changed ? 'updated' : 'unchanged'
  } catch (error) {
    await deps.recordFailure(connector.id, friendly(error))
    return 'failed'
  }
}

// "Sync now" on a goal page.
export async function syncSeries(userId: string, seriesId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const connector = await deps.forSeries(userId, seriesId)
  if (!connector) throw new PersonalRuleError('This measure is not synced.')
  return syncConnector(connector, now, deps)
}

// Syncs when a goal page opens and the last sync is old.
export async function syncIfStale(userId: string, seriesId: string, now: Date = clockNow(), deps: Deps = defaultDeps) {
  const connector = await deps.forSeries(userId, seriesId)
  if (connector && (!connector.lastSyncedAt || now.getTime() - connector.lastSyncedAt.getTime() > STALE_AFTER_MS)) {
    await syncConnector(connector, now, deps)
  }
}

// The daily job: every connector, each on its owner's clock.
export async function syncAllConnectors(deps: Deps = defaultDeps) {
  const results = { updated: 0, unchanged: 0, failed: 0 }

  for (const connector of await deps.listAll()) {
    const result = await withClockZone(connector.timeZone, () => syncConnector(connector, clockNow(), deps))
    results[result] += 1
  }

  return results
}

export async function getSyncStatus(userId: string, seriesId: string, deps: Deps = defaultDeps) {
  const connector = await deps.forSeries(userId, seriesId)
  return connector
    ? { provider: connector.provider, account: connector.accountRef, timeControl: connector.timeControl, lastSyncedAt: connector.lastSyncedAt, lastError: connector.lastError }
    : null
}
