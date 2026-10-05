import { describe, expect, it } from 'vitest'

import { expenseForm, incomeForm, planAllocationForm, saveRemainingForm } from '@/app/(shell)/finance/schema'
import { chestForm } from '@/app/(shell)/finance/chests/schema'
import { goalForm as personalGoalForm, valueForm } from '@/app/(shell)/personal/goals/schema'
import { entryForm } from '@/app/(shell)/personal/journal/schema'
import { capacityForm, taskForm } from '@/app/(shell)/personal/tasks/schema'
import { operations } from '@/application/api/operations'
import { splitBody } from '@/domain/personal/journal'
import type { FormHandler } from '@/lib/forms/FormHandler'

// Hostile input (Ressources/security-codebase-plan.md, step 4; test plan §5.3):
// every form and API input refuses what is not a sensible value, before any
// use case or database write.

const formData = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.append(key, value)
  return data
}

const accepts = (form: FormHandler<never>, values: Record<string, string>) => (form as FormHandler<never>).parse(formData(values)).ok

const LONG = 'x'.repeat(10_001)
const BAD_AMOUNTS = ['-5', '0', 'NaN', 'Infinity', '-Infinity', '1e309', '1e5', '', ' ', '12.345', '9999999999999', 'abc', '1,000', '0x10']

describe('money fields', () => {
  const cases: [string, FormHandler<never>, Record<string, string>][] = [
    ['expense', expenseForm as never, { amount: '1500', category: 'food' }],
    ['save what is left', saveRemainingForm as never, { amount: '500' }],
    ['income', incomeForm as never, { source: 'Salary', amount: '300000', payDay: '25' }],
    ['allocation', planAllocationForm as never, { name: 'Rent', amount: '100000', period: 'monthly', category: 'fixed' }],
  ]

  it.each(cases)('the %s form accepts a sensible amount and refuses every hostile one', (_name, form, valid) => {
    expect(accepts(form, valid)).toBe(true)
    for (const amount of BAD_AMOUNTS) {
      expect(accepts(form, { ...valid, amount }), `amount ${JSON.stringify(amount)}`).toBe(false)
    }
  })
})

describe('text fields and choices', () => {
  it('refuse 10,000-character text and unknown choices', () => {
    expect(accepts(expenseForm as never, { amount: '1', category: 'food', description: LONG })).toBe(false)
    expect(accepts(expenseForm as never, { amount: '1', category: 'rockets' })).toBe(false)
    expect(accepts(planAllocationForm as never, { name: LONG, amount: '1', period: 'monthly', category: 'fixed' })).toBe(false)
    expect(accepts(planAllocationForm as never, { name: 'Rent', amount: '1', period: 'hourly', category: 'fixed' })).toBe(false)
    expect(accepts(chestForm as never, { name: LONG, type: 'AVAILABLE' })).toBe(false)
    expect(accepts(chestForm as never, { name: 'Trip', type: 'TREASURE' })).toBe(false)
    expect(accepts(chestForm as never, { name: 'Trip', type: 'AVAILABLE', lockedUntil: 'tomorrow' })).toBe(false)
    expect(accepts(incomeForm as never, { source: 'Salary', amount: '1', payDay: '32' })).toBe(false)
    expect(accepts(incomeForm as never, { source: 'Salary', amount: '1', payDay: '0' })).toBe(false)
  })

  it('refuse bad Personal input', () => {
    expect(accepts(taskForm as never, { title: LONG })).toBe(false)
    expect(accepts(taskForm as never, { title: ' ' })).toBe(false)
    expect(accepts(taskForm as never, { title: 'x', repeat: 'hourly' })).toBe(false)
    expect(accepts(taskForm as never, { title: 'x', repeat: 'everyN', every: '-1' })).toBe(false)
    expect(accepts(capacityForm as never, { capacity: '1e3' })).toBe(false)
    expect(accepts(valueForm as never, { goalId: 'g', value: 'Infinity' })).toBe(false)
    expect(accepts(valueForm as never, { goalId: 'g', value: '1e309' })).toBe(false)
    expect(accepts(valueForm as never, { goalId: 'g', value: 'NaN' })).toBe(false)
    expect(accepts(personalGoalForm as never, { preset: 'outcome', name: 'x', target: 'NaN' })).toBe(false)
    expect(accepts(personalGoalForm as never, { preset: 'teleport', name: 'x' })).toBe(false)
    expect(accepts(entryForm as never, { body: LONG })).toBe(false)
    for (const mood of ['0', '6', '2.5', '-1', 'happy']) {
      expect(accepts(entryForm as never, { body: 'ok', mood }), `mood ${mood}`).toBe(false)
    }
  })
})

describe('API inputs', () => {
  const refused = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success === false

  it('refuse hostile amounts, including what JSON turns into Infinity', () => {
    for (const amount of [-1, 0, Infinity, -Infinity, Number.NaN, 1e15, '1500', null]) {
      expect(refused(operations.recordExpense.input, { amount, category: 'food' }), `amount ${String(amount)}`).toBe(true)
    }
    expect(refused(operations.recordExpense.input, { amount: 1500, category: 'food' })).toBe(false)
  })

  it('refuse long text, unknown choices and wrong types', () => {
    expect(refused(operations.recordExpense.input, { amount: 1, category: 'food', description: LONG })).toBe(true)
    expect(refused(operations.recordExpense.input, { amount: 1, category: { $ne: null } })).toBe(true)
    expect(refused(operations.addAllocation.input, { name: LONG, amount: 1, category: 'fixed' })).toBe(true)
    expect(refused(operations.addTask.input, { title: LONG })).toBe(true)
    expect(refused(operations.logSession.input, { minutes: 1e9 })).toBe(true)
    expect(refused(operations.logSession.input, { minutes: 1.5 })).toBe(true)
    expect(refused(operations.writeJournalEntry.input, { text: 'x', kind: 'SECRET' })).toBe(true)
  })
})

describe('markup typed by a person stays text', () => {
  it('is never read as a link or tag in a journal entry', () => {
    const payload = '<img src=x onerror=alert(1)> "><script>alert(1)</script> [x](javascript:alert(1))'
    expect(splitBody(payload)).toEqual([{ kind: 'text', text: payload }])
  })

  it('only links to goals and tasks, with safe ids', () => {
    expect(splitBody('@[x](goal:"><script>)')).toEqual([{ kind: 'text', text: '@[x](goal:"><script>)' }])
    expect(splitBody('@[x](javascript:alert)')).toEqual([{ kind: 'text', text: '@[x](javascript:alert)' }])
  })
})
