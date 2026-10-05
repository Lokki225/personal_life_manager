import { describe, expect, it, vi } from 'vitest'

import { ChessComError } from '@/infrastructure/connectors/chesscom'

import { connectChess, syncAllConnectors, syncConnector, syncIfStale } from './sync'

const now = new Date(2026, 9, 7, 6, 15)

const connector = (extra: object = {}) => ({
  id: 'c',
  userId: 'u',
  provider: 'chess.com',
  accountRef: 'franklin',
  timeControl: 'rapid',
  lastSyncedAt: new Date(2026, 9, 6, 6, 15),
  lastError: null,
  timeZone: 'Africa/Abidjan',
  seriesId: 's',
  latest: 1543,
  ...extra,
})

function deps(extra: object = {}) {
  return {
    listSeries: async () => [{ key: 'chess_com_rapid_franklin' }],
    createConnector: vi.fn(async () => ({ connectorId: 'c', seriesId: 's', unit: null })),
    forSeries: vi.fn(async () => connector()),
    recordSuccess: vi.fn(async () => {}),
    recordFailure: vi.fn(async () => {}),
    listAll: async () => [connector(), connector({ id: 'c2', latest: 1400 })],
    fetchRating: vi.fn(async () => ({ rating: 1560, at: null })),
    ...extra,
  }
}

describe('connectChess', () => {
  it('checks the account, then keeps today’s rating as the first value', async () => {
    const d = deps()
    await connectChess('u', { username: ' franklin ', timeControl: 'rapid' }, now, d as never)

    expect(d.fetchRating).toHaveBeenCalledWith('franklin', 'rapid')
    expect(d.createConnector).toHaveBeenCalledWith('u', {
      provider: 'chess.com',
      accountRef: 'franklin',
      timeControl: 'rapid',
      series: { key: 'chess_com_rapid_franklin_2', label: 'chess.com rapid (franklin)' },
      first: { value: 1560, at: now },
    })
  })

  it('says plainly why an account cannot be followed', async () => {
    const failing = (reason: 'unknown_player' | 'no_rating' | 'unavailable') =>
      deps({ fetchRating: async () => Promise.reject(new ChessComError('x', reason)) }) as never

    await expect(connectChess('u', { username: 'nobody_here', timeControl: 'rapid' }, now, failing('unknown_player'))).rejects.toMatchObject({
      message: 'No chess.com player has this username.',
      field: 'chessUsername',
    })
    await expect(connectChess('u', { username: 'franklin', timeControl: 'daily' }, now, failing('no_rating'))).rejects.toThrow(
      'This player has no rating in that time control yet.',
    )
    await expect(connectChess('u', { username: 'a b', timeControl: 'rapid' }, now, deps() as never)).rejects.toMatchObject({ field: 'chessUsername' })
  })
})

describe('syncConnector', () => {
  it('adds a value only when the rating moved', async () => {
    const d = deps()
    expect(await syncConnector(connector(), now, d as never)).toBe('updated')
    expect(d.recordSuccess).toHaveBeenCalledWith('c', now, { seriesId: 's', value: 1560, source: 'chess.com' })

    expect(await syncConnector(connector({ latest: 1560 }), now, d as never)).toBe('unchanged')
    expect(d.recordSuccess).toHaveBeenLastCalledWith('c', now, null)
  })

  it('keeps a failure on the connector instead of throwing', async () => {
    const d = deps({ fetchRating: async () => Promise.reject(new ChessComError('x', 'unavailable')) })
    expect(await syncConnector(connector(), now, d as never)).toBe('failed')
    expect(d.recordFailure).toHaveBeenCalledWith('c', 'chess.com could not be reached. Try again in a moment.')
  })
})

describe('syncIfStale and the daily job', () => {
  it('syncs a goal page’s measure only after 12 hours', async () => {
    const fresh = deps({ forSeries: async () => connector({ lastSyncedAt: new Date(2026, 9, 7, 1) }) })
    await syncIfStale('u', 's', now, fresh as never)
    expect(fresh.fetchRating).not.toHaveBeenCalled()

    const stale = deps()
    await syncIfStale('u', 's', now, stale as never)
    expect(stale.fetchRating).toHaveBeenCalled()
  })

  it('goes through every connector and counts what happened', async () => {
    expect(await syncAllConnectors(deps() as never)).toEqual({ updated: 2, unchanged: 0, failed: 0 })
  })
})
