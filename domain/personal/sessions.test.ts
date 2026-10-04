import { describe, expect, it } from 'vitest'

import { seriesKey, sessionMinutes } from './sessions'

describe('sessionMinutes', () => {
  it('rounds to whole minutes, at least one', () => {
    const start = new Date(2026, 9, 7, 9, 0, 0)
    expect(sessionMinutes(start, new Date(2026, 9, 7, 9, 44, 40))).toBe(45)
    expect(sessionMinutes(start, new Date(2026, 9, 7, 9, 0, 5))).toBe(1)
  })
})

describe('seriesKey', () => {
  it('makes a key from a label, and numbers it when taken', () => {
    expect(seriesKey('Chess rapid', [])).toBe('chess_rapid')
    expect(seriesKey('Vocabulaire japonais', [])).toBe('vocabulaire_japonais')
    expect(seriesKey('Élo !', [])).toBe('elo')
    expect(seriesKey('Chess rapid', ['chess_rapid', 'chess_rapid_2'])).toBe('chess_rapid_3')
    expect(seriesKey('!!!', [])).toBe('series')
  })
})
