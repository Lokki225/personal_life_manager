import { describe, expect, it } from 'vitest'

import { fieldName } from '@/lib/forms/formState'

import { customGoalForm, goalForm } from './schema'

const formDataOf = (entries: Record<string, string>) => {
  const formData = new FormData()
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value))
  return formData
}

const condition = (index: number, values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [fieldName('conditions', index, key), value]))

describe('custom goal form', () => {
  it('parses a goal with two different conditions', () => {
    const result = customGoalForm.parse(
      formDataOf({
        name: 'Disciplined month',
        logic: 'ALL',
        ...condition(0, { measurement: 'chest_balance', operator: 'GTE', targetValue: '50000', chestId: 'base' }),
        ...condition(1, { measurement: 'monthly_deviation_count', operator: 'LTE', targetValue: '0' }),
      }),
    )

    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Disciplined month',
        logic: 'ALL',
        conditions: [
          { measurement: 'chest_balance', operator: 'GTE', targetValue: 50000, chestId: 'base' },
          { measurement: 'monthly_deviation_count', operator: 'LTE', targetValue: 0 },
        ],
      },
    })
  })

  it('reports problems on the condition they belong to', () => {
    const result = customGoalForm.parse(
      formDataOf({
        name: 'Goal',
        logic: 'SOMETIMES',
        ...condition(0, { measurement: 'weight', operator: 'GTE', targetValue: '-5' }),
      }),
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.state.fieldErrors).toEqual({
      logic: ['Choose how conditions combine.'],
      'conditions.0.measurement': ['Choose what to measure.'],
      'conditions.0.targetValue': ['Enter a whole number.'],
    })
  })

  it('needs at least one condition', () => {
    const result = customGoalForm.parse(formDataOf({ name: 'Goal', logic: 'ANY' }))

    expect(!result.ok && result.state.fieldErrors.conditions).toEqual(['Add at least one condition.'])
  })
})

describe('savings goal form', () => {
  it('treats an empty "already put aside" as zero', () => {
    const result = goalForm.parse(formDataOf({ name: 'Headphones', targetAmount: '30000', alreadySaved: '' }))

    expect(result).toEqual({ ok: true, data: { name: 'Headphones', targetAmount: 30000, alreadySaved: 0 } })
  })
})
