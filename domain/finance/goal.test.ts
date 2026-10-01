import { describe, expect, it } from 'vitest'

import { evaluateCondition, evaluateGoalLogic } from './goal'

describe('evaluateCondition', () => {
  it('compares the actual value with the target for each operator', () => {
    expect(evaluateCondition('GTE', 30000, 30000)).toBe(true)
    expect(evaluateCondition('GTE', 29999, 30000)).toBe(false)
    expect(evaluateCondition('GT', 30000, 30000)).toBe(false)
    expect(evaluateCondition('GT', 30001, 30000)).toBe(true)
    expect(evaluateCondition('LTE', 3, 3)).toBe(true)
    expect(evaluateCondition('LTE', 4, 3)).toBe(false)
    expect(evaluateCondition('LT', 3, 3)).toBe(false)
    expect(evaluateCondition('LT', 2, 3)).toBe(true)
    expect(evaluateCondition('EQ', 0, 0)).toBe(true)
    expect(evaluateCondition('EQ', 1, 0)).toBe(false)
  })
})

describe('evaluateGoalLogic', () => {
  it('needs every condition for ALL', () => {
    expect(evaluateGoalLogic('ALL', [true, true])).toBe(true)
    expect(evaluateGoalLogic('ALL', [true, false])).toBe(false)
  })

  it('needs one condition for ANY', () => {
    expect(evaluateGoalLogic('ANY', [false, true])).toBe(true)
    expect(evaluateGoalLogic('ANY', [false, false])).toBe(false)
  })
})
