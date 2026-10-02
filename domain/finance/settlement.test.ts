import { describe, expect, it } from 'vitest'

import { settlementActions } from './settlement'

// October 2026: the 2nd is a Friday, the 4th a Sunday, the 5th a Monday.
const day = (date: number) => new Date(2026, 9, date)
const endOf = (date: number) => new Date(2026, 9, date, 23, 59, 59)

describe('settlementActions', () => {
  it('sends each day’s leftover to the Buffer, and nothing for a day with none', () => {
    const leftovers: Record<number, number> = { 2: 500, 3: 0, 4: 1200.9 }

    expect(
      settlementActions({
        firstDay: day(2),
        lastDay: day(4),
        sweepDay: 3,
        bufferBalance: 0,
        leftoverOf: (date) => leftovers[date.getDate()],
      }),
    ).toEqual([
      { kind: 'leftover', at: endOf(2), amount: 500 },
      { kind: 'leftover', at: endOf(4), amount: 1200 },
    ])
  })

  it('empties the Buffer when the sweep day begins, with what it held plus the days before', () => {
    // Sweep on Sunday (0): it happens as Sunday the 4th starts.
    expect(
      settlementActions({
        firstDay: day(2),
        lastDay: day(4),
        sweepDay: 0,
        bufferBalance: 1000,
        leftoverOf: () => 500,
      }),
    ).toEqual([
      { kind: 'leftover', at: endOf(2), amount: 500 },
      { kind: 'leftover', at: endOf(3), amount: 500 },
      { kind: 'sweep', at: day(4), amount: 2000 },
      { kind: 'leftover', at: endOf(4), amount: 500 },
    ])
  })

  it('has nothing to sweep from an empty Buffer, and nothing to do without days', () => {
    expect(
      settlementActions({ firstDay: day(3), lastDay: day(3), sweepDay: 0, bufferBalance: 0, leftoverOf: () => 0 }),
    ).toEqual([])
    expect(
      settlementActions({ firstDay: day(5), lastDay: day(4), sweepDay: 0, bufferBalance: 900, leftoverOf: () => 500 }),
    ).toEqual([])
  })
})
