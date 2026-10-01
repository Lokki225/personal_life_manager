import { describe, expect, it } from 'vitest'

import { formDataToObject, formDataToValues } from './formData'

const formDataOf = (entries: [string, string | File][]) => {
  const formData = new FormData()
  entries.forEach(([key, value]) => formData.append(key, value))
  return formData
}

describe('formDataToObject', () => {
  it('keeps flat keys as they are', () => {
    expect(formDataToObject(formDataOf([['name', 'Rent'], ['amount', '100']]))).toEqual({
      name: 'Rent',
      amount: '100',
    })
  })

  it('builds an array of rows from dot paths', () => {
    const formData = formDataOf([
      ['allocations.0.name', 'Rent'],
      ['allocations.0.amount', '100000'],
      ['allocations.1.name', 'Netflix'],
    ])

    expect(formDataToObject(formData)).toEqual({
      allocations: [{ name: 'Rent', amount: '100000' }, { name: 'Netflix' }],
    })
  })

  it('skips React action keys and files', () => {
    const formData = formDataOf([
      ['$ACTION_ID_abc', 'x'],
      ['receipt', new File(['x'], 'receipt.txt')],
      ['name', 'Rent'],
    ])

    expect(formDataToObject(formData)).toEqual({ name: 'Rent' })
  })

  it('skips unsafe keys without touching object prototypes', () => {
    const formData = formDataOf([
      ['__proto__.polluted', 'yes'],
      ['constructor.prototype.polluted', 'yes'],
      ['a.__proto__.polluted', 'yes'],
    ])

    expect(formDataToObject(formData)).toEqual({})
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('skips paths that are too deep or indexed too high', () => {
    const formData = formDataOf([
      ['a.b.c.d.e', 'too deep'],
      ['rows.100.name', 'too far'],
      ['rows.99.name', 'kept'],
    ])

    const result = formDataToObject(formData) as { rows: { name: string }[] }

    expect(Object.keys(result)).toEqual(['rows'])
    expect(result.rows[99]).toEqual({ name: 'kept' })
    expect(result.rows[100]).toBeUndefined()
  })

  it('keeps the last value of a repeated key and ignores conflicting shapes', () => {
    const formData = formDataOf([
      ['name', 'first'],
      ['name', 'second'],
      ['amount', '1'],
      ['amount.0', 'conflict'],
    ])

    expect(formDataToObject(formData)).toEqual({ name: 'second', amount: '1' })
  })
})

describe('formDataToValues', () => {
  it('echoes only string fields', () => {
    const formData = formDataOf([
      ['allocations.0.name', 'Rent'],
      ['$ACTION_ID_abc', 'x'],
      ['receipt', new File(['x'], 'receipt.txt')],
    ])

    expect(formDataToValues(formData)).toEqual({ 'allocations.0.name': 'Rent' })
  })
})
