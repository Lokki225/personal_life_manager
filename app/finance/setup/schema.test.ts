import { describe, expect, it } from 'vitest'

import { fieldName } from '@/lib/forms/formState'

import { setupForm } from './schema'

// Builds the FormData exactly as the setup page names its inputs.
const setupFormData = (rows: Record<string, string>[], income: Record<string, string> = {}) => {
  const formData = new FormData()
  const fields = { incomeSource: 'Salary', incomeAmount: '300000', incomeFrequency: 'monthly', incomePayDay: '25', ...income }

  Object.entries(fields).forEach(([key, value]) => formData.append(key, value))
  rows.forEach((row, index) =>
    Object.entries(row).forEach(([key, value]) => formData.append(fieldName('allocations', index, key), value)),
  )

  return formData
}

const rent = { name: 'Rent', amount: '100000', period: 'monthly', category: 'fixed' }
const bread = { name: "Everyday's bread", amount: '60000', period: 'monthly', category: 'daily_living' }

const errorsOf = (formData: FormData) => {
  const result = setupForm.parse(formData)
  return result.ok ? {} : result.state.fieldErrors
}

describe('setup form', () => {
  it('parses what the page submits into a typed plan', () => {
    expect(setupForm.parse(setupFormData([rent, bread]))).toEqual({
      ok: true,
      data: {
        incomeSource: 'Salary',
        incomeAmount: 300000,
        incomeFrequency: 'monthly',
        incomePayDay: 25,
        allocations: [
          { name: 'Rent', amount: 100000, period: 'monthly', category: 'fixed' },
          { name: "Everyday's bread", amount: 60000, period: 'monthly', category: 'daily_living' },
        ],
      },
    })
  })

  it('asks for at least one allocation', () => {
    expect(errorsOf(setupFormData([]))).toEqual({ allocations: ['Add at least one allocation.'] })
  })

  it('reports each problem on its own row and field', () => {
    const errors = errorsOf(
      setupFormData([rent, { name: '', amount: '-5', period: 'monthly', category: 'luxury' }], { incomeAmount: '' }),
    )

    expect(errors['incomeAmount']?.[0]).toBe('Enter an amount.')
    expect(errors['allocations.1.name']).toEqual(['Enter an allocation name.'])
    expect(errors['allocations.1.amount']).toEqual(['Use digits only, for example 60000.'])
    expect(errors['allocations.1.category']).toEqual(['Choose a category.'])
    expect(errors['allocations.0.name']).toBeUndefined()
  })

  it('only accepts a pay day that exists in a month', () => {
    for (const day of ['0', '32', '1.5', 'x', '']) {
      expect(errorsOf(setupFormData([rent], { incomePayDay: day }))).toEqual({
        incomePayDay: ['Enter a day from 1 to 31.'],
      })
    }
  })

  it('gives a readable message when a whole row is missing', () => {
    const formData = setupFormData([])
    Object.entries(rent).forEach(([key, value]) => formData.append(fieldName('allocations', 1, key), value))

    expect(errorsOf(formData)).toEqual({ 'allocations.0': ['Fill in this allocation.'] })
  })
})
