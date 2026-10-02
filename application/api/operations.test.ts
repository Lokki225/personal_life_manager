import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { localTime } from './operation'
import { operationList, operations } from './operations'

describe('API operations', () => {
  it('have distinct names and addresses', () => {
    const names = operationList.map((operation) => operation.name)
    const addresses = operationList.map((operation) => `${operation.method} ${operation.path}`)

    expect(new Set(names).size).toBe(names.length)
    expect(new Set(addresses).size).toBe(addresses.length)
    names.forEach((name) => expect(name).toMatch(/^[a-z_]+$/))
  })

  it('never change anything through a GET, and need a recording key otherwise', () => {
    for (const operation of operationList) {
      expect(operation.needs, operation.name).toBe(operation.method === 'GET' ? 'READ' : 'WRITE')
    }
  })

  it('each have their route file', () => {
    for (const operation of operationList) {
      const file = join('app', 'api', 'v1', ...operation.path.replace('{id}', '[id]').split('/'), 'route.ts')

      expect(existsSync(file), file).toBe(true)
      expect(readFileSync(file, 'utf8'), file).toMatch(new RegExp(`export const ${operation.method} = route\\(`))
    }
  })

  it('describe their input in a form an assistant can read', () => {
    for (const operation of operationList) {
      const schema = z.toJSONSchema(operation.input, { io: 'input' })

      expect(schema.type, operation.name).toBe('object')
    }
  })

  it('refuse a change that changes nothing', () => {
    expect(operations.editExpense.input.safeParse({ id: 'expense-1' }).success).toBe(false)
    expect(operations.editExpense.input.safeParse({ id: 'expense-1', amount: 1200 }).success).toBe(true)
    expect(operations.editIncome.input.safeParse({ id: 'income-1' }).success).toBe(false)
    expect(operations.editAllocation.input.safeParse({ id: 'allocation-1', name: 'Rent' }).success).toBe(true)
  })

  it('ask a goal for a target or for conditions', () => {
    const { input } = operations.createGoal

    expect(input.safeParse({ name: 'Laptop' }).success).toBe(false)
    expect(input.safeParse({ name: 'Laptop', targetAmount: 400000 }).success).toBe(true)
    expect(
      input.safeParse({
        name: 'Calm month',
        conditions: [{ measurement: 'monthly_deviation_count', operator: 'LTE', targetValue: 0 }],
      }).success,
    ).toBe(true)
  })

  it('accept only real calendar days', () => {
    const { input } = operations.createChest

    expect(input.safeParse({ name: 'Trip', type: 'SECURE', lockedUntil: '2026-12-31' }).success).toBe(true)
    expect(input.safeParse({ name: 'Trip', type: 'SECURE', lockedUntil: '2026-13-45' }).success).toBe(false)
    expect(input.safeParse({ name: 'Trip', type: 'SECURE', lockedUntil: 'tomorrow' }).success).toBe(false)
  })
})

describe('localTime', () => {
  it('writes a date as its owner reads it, without a time zone', () => {
    expect(localTime(new Date(2026, 9, 3, 19, 30, 5))).toBe('2026-10-03T19:30:05')
    expect(localTime(null)).toBeNull()
  })
})
