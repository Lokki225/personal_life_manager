import { isChessUsername, readRating, type TimeControl } from '../../domain/personal/chess'

// chess.com's public, read-only API (no key). Checked on 2026-10-04:
// GET https://api.chess.com/pub/player/{username}/stats, 404 for an unknown player.

export class ChessComError extends Error {
  constructor(
    message: string,
    readonly reason: 'unknown_player' | 'no_rating' | 'unavailable',
  ) {
    super(message)
    this.name = 'ChessComError'
  }
}

export async function fetchChessRating(username: string, timeControl: TimeControl) {
  if (!isChessUsername(username)) {
    throw new ChessComError(`No chess.com player is called ${username}.`, 'unknown_player')
  }

  let response: Response
  try {
    response = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/stats`, {
      headers: { 'User-Agent': 'PersonalLifeManager/1.0 (https://personal-life-manager-delta.vercel.app)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new ChessComError('chess.com did not answer.', 'unavailable')
  }

  if (response.status === 404) {
    throw new ChessComError(`No chess.com player is called ${username}.`, 'unknown_player')
  }
  if (!response.ok) {
    throw new ChessComError(`chess.com answered with an error (${response.status}).`, 'unavailable')
  }

  const rating = readRating(await response.json(), timeControl)
  if (!rating) {
    throw new ChessComError(`${username} has no ${timeControl} rating on chess.com yet.`, 'no_rating')
  }

  return rating
}
