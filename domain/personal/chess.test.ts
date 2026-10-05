import { describe, expect, it } from 'vitest'

import { isChessUsername, ratingChanged, readRating } from './chess'

// The shape chess.com answered with on 2026-10-04 (trimmed).
const stats = {
  chess_rapid: { last: { rating: 1543, date: 1786796329, rd: 44 }, best: { rating: 1600 } },
  chess_blitz: { last: { rating: 1320, date: 1791157997 } },
  tactics: { highest: { rating: 2730 } },
}

describe('readRating', () => {
  it('reads the last rating of a time control, with its date', () => {
    expect(readRating(stats, 'rapid')).toEqual({ rating: 1543, at: new Date(1786796329 * 1000) })
    expect(readRating(stats, 'blitz')?.rating).toBe(1320)
  })

  it('gives nothing for a time control never played, or an odd answer', () => {
    expect(readRating(stats, 'bullet')).toBeNull()
    expect(readRating(null, 'rapid')).toBeNull()
    expect(readRating({ chess_rapid: { last: { rating: '1500' } } }, 'rapid')).toBeNull()
  })
})

describe('usernames and changes', () => {
  it('accepts chess.com usernames only', () => {
    expect(isChessUsername('Hikaru')).toBe(true)
    expect(isChessUsername('magnus_c-2')).toBe(true)
    expect(isChessUsername('ab')).toBe(false)
    expect(isChessUsername('a b')).toBe(false)
    expect(isChessUsername('../admin')).toBe(false)
  })

  it('records a value only when the rating moved', () => {
    expect(ratingChanged(null, 1500)).toBe(true)
    expect(ratingChanged(1500, 1500)).toBe(false)
    expect(ratingChanged(1500, 1512)).toBe(true)
  })
})
