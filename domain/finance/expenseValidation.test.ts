import { describe, expect, it } from 'vitest'

import { validateExpenseInput } from './expenseValidation'

describe('validateExpenseInput', () => {
  it('rejects non-positive amounts', () => {
    expect(validateExpenseInput(0, 'food')).toBe('Please enter a valid amount greater than zero.')
    expect(validateExpenseInput(-5, 'food')).toBe('Please enter a valid amount greater than zero.')
  })

  it('rejects missing category values', () => {
    expect(validateExpenseInput(35, '')).toBe('Please select a category for this expense.')
    expect(validateExpenseInput(35, null)).toBe('Please select a category for this expense.')
  })

  it('accepts valid values', () => {
    expect(validateExpenseInput(35, 'food')).toBeNull()
  })
})
