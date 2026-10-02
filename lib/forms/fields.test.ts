import { describe, expect, it } from 'vitest'

import { moneyField, requiredText } from './fields'

const firstMessage = (value: unknown) => {
  const result = moneyField.safeParse(value)
  return result.success ? null : result.error.issues[0].message
}

describe('moneyField', () => {
  it('accepts plain amounts and converts them to numbers', () => {
    expect(moneyField.parse(' 12 ')).toBe(12)
    expect(moneyField.parse('12.50')).toBe(12.5)
    expect(moneyField.parse('999999999999')).toBe(999999999999)
  })

  it('asks for an amount when the field is empty or missing', () => {
    expect(firstMessage('')).toBe('Enter an amount.')
    expect(firstMessage(' ')).toBe('Enter an amount.')
    expect(firstMessage(undefined)).toBe('Enter an amount.')
  })

  it('rejects anything that is not plain digits', () => {
    for (const value of ['abc', '-3', '1e3', '0x10', 'Infinity', '12,5', '99999999999999999999']) {
      expect(firstMessage(value)).toBe('Use digits only, for example 60000.')
    }
  })

  it('rejects zero', () => {
    expect(firstMessage('0')).toBe('Enter an amount greater than zero.')
  })
})

describe('requiredText', () => {
  const name = requiredText('Enter a name.', 10)

  it('trims and requires a value', () => {
    expect(name.parse('  Rent ')).toBe('Rent')
    expect(name.safeParse('   ').error?.issues[0].message).toBe('Enter a name.')
    expect(name.safeParse(undefined).error?.issues[0].message).toBe('Enter a name.')
  })

  it('limits the length', () => {
    expect(name.safeParse('x'.repeat(11)).error?.issues[0].message).toBe('Keep it under 10 characters.')
  })
})
