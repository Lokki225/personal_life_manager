import { describe, expect, it } from 'vitest'

import { lateExpenseSplit, occurredAtProblem } from './capture'

describe('occurredAtProblem', () => {
  const now = new Date(2026, 9, 7, 12)

  it('accepts today, yesterday and a slightly fast clock', () => {
    expect(occurredAtProblem(new Date(2026, 9, 7, 9), now)).toBeNull()
    expect(occurredAtProblem(new Date(2026, 9, 6, 21), now)).toBeNull()
    expect(occurredAtProblem(new Date(2026, 9, 7, 18), now)).toBeNull()
  })

  it('refuses the future, the far past and nonsense', () => {
    expect(occurredAtProblem(new Date(2026, 9, 9), now)).toBe('This action is dated in the future.')
    expect(occurredAtProblem(new Date(2026, 8, 1), now)).toBe('This action is more than a month old.')
    expect(occurredAtProblem(new Date('nope'), now)).toBe('This action has no valid date.')
  })
})

describe('lateExpenseSplit', () => {
  it('takes back from the closed day’s leftover first, the rest is overspend', () => {
    expect(lateExpenseSplit({ amount: 500, leftover: 1200, alreadyTakenBack: 0 })).toEqual({ takeBack: 500, over: 0 })
    expect(lateExpenseSplit({ amount: 1500, leftover: 1200, alreadyTakenBack: 0 })).toEqual({ takeBack: 1200, over: 300 })
  })

  it('never takes back twice what an earlier late expense already took', () => {
    expect(lateExpenseSplit({ amount: 800, leftover: 1200, alreadyTakenBack: 1000 })).toEqual({ takeBack: 200, over: 600 })
    expect(lateExpenseSplit({ amount: 800, leftover: 1200, alreadyTakenBack: 1200 })).toEqual({ takeBack: 0, over: 800 })
  })

  it('is all overspend for a day that left nothing', () => {
    expect(lateExpenseSplit({ amount: 300, leftover: 0, alreadyTakenBack: 0 })).toEqual({ takeBack: 0, over: 300 })
  })
})
