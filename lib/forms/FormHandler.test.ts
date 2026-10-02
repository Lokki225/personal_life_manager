import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { FormHandler, type RuleError } from './FormHandler'
import { moneyField, requiredText } from './fields'

class RuleViolation extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}

const isRuleError = (error: unknown): error is RuleError => error instanceof RuleViolation

const schema = z
  .object({
    title: requiredText('Enter a title.'),
    confirmTitle: z.string(),
    rows: z.array(z.object({ amount: moneyField })),
  })
  .refine((data) => data.title === data.confirmTitle, 'Titles must match.')

const form = new FormHandler(schema, { isRuleError })

const formDataOf = (entries: Record<string, string>) => {
  const formData = new FormData()
  Object.entries(entries).forEach(([key, value]) => formData.append(key, value))
  return formData
}

const valid = { title: 'Plan', confirmTitle: 'Plan', 'rows.0.amount': '5', 'rows.1.amount': '7.50' }

describe('FormHandler.parse', () => {
  it('returns typed, converted data for valid input', () => {
    expect(form.parse(formDataOf(valid))).toEqual({
      ok: true,
      data: { title: 'Plan', confirmTitle: 'Plan', rows: [{ amount: 5 }, { amount: 7.5 }] },
    })
  })

  it('keys a row error by its full path and echoes the submitted values', () => {
    const entries = { ...valid, 'rows.1.amount': 'abc' }
    const result = form.parse(formDataOf(entries))

    expect(result).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: { 'rows.1.amount': ['Use digits only, for example 60000.'] },
        formErrors: [],
        values: entries,
      },
    })
  })

  it('puts a form-level issue in formErrors', () => {
    const result = form.parse(formDataOf({ ...valid, confirmTitle: 'Other' }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.state.formErrors).toEqual(['Titles must match.'])
  })
})

describe('FormHandler.submit', () => {
  it('runs the handler with valid data and reports success', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    await expect(form.submit(formDataOf(valid), run)).resolves.toEqual({
      status: 'success',
      fieldErrors: {},
      formErrors: [],
    })
    expect(run).toHaveBeenCalledWith({
      title: 'Plan',
      confirmTitle: 'Plan',
      rows: [{ amount: 5 }, { amount: 7.5 }],
    })
  })

  it('does not run the handler when the input is invalid', async () => {
    const run = vi.fn()
    const state = await form.submit(formDataOf({ ...valid, title: '' }), run)

    expect(run).not.toHaveBeenCalled()
    expect(state.fieldErrors.title).toEqual(['Enter a title.'])
  })

  it('turns a rule error into a field error or a form error', async () => {
    const onField = await form.submit(formDataOf(valid), async () => {
      throw new RuleViolation('Already used.', 'title')
    })
    const onForm = await form.submit(formDataOf(valid), async () => {
      throw new RuleViolation('Plan is locked.')
    })

    expect(onField).toMatchObject({ status: 'error', fieldErrors: { title: ['Already used.'] }, formErrors: [] })
    expect(onForm).toMatchObject({ status: 'error', fieldErrors: {}, formErrors: ['Plan is locked.'] })
  })

  it('rethrows any other error untouched', async () => {
    const crash = new Error('database down')

    await expect(
      form.submit(formDataOf(valid), async () => {
        throw crash
      }),
    ).rejects.toBe(crash)
  })
})
