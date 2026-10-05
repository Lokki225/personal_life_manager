import { describe, expect, it } from 'vitest'

import { isoDay, snapshotKeyFor } from './snapshots'

describe('snapshotKeyFor', () => {
  it('maps the four offline screens, with or without a trailing slash', () => {
    expect(snapshotKeyFor('/finance')).toBe('finance.today')
    expect(snapshotKeyFor('/finance/today/')).toBe('finance.today')
    expect(snapshotKeyFor('/finance/review')).toBe('finance.review')
    expect(snapshotKeyFor('/personal')).toBe('personal.today')
    expect(snapshotKeyFor('/personal/review')).toBe('personal.review')
  })

  it('has nothing for other pages', () => {
    expect(snapshotKeyFor('/finance/chests')).toBeNull()
    expect(snapshotKeyFor('/personal/journal/abc')).toBeNull()
    expect(snapshotKeyFor('/')).toBeNull()
  })

  it('writes a day on the local clock', () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
