import { describe, expect, it } from 'vitest'

import { dueDateFrom, recurrenceFrom, taskForm } from './schema'

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return taskForm.parse(data)
}

const today = new Date(2026, 9, 7)

describe('the task form', () => {
  it('reads a one-off task for today by default', () => {
    const result = form({ title: 'Call home' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(recurrenceFrom(result.data)).toBeNull()
    expect(dueDateFrom(result.data, today)).toEqual(today)
  })

  it('reads tomorrow, a date and the inbox', () => {
    const at = (entries: Record<string, string>) => {
      const result = form({ title: 'x', ...entries })
      return result.ok ? dueDateFrom(result.data, today) : 'invalid'
    }
    expect(at({ when: 'tomorrow' })).toEqual(new Date(2026, 9, 8))
    expect(at({ when: 'date', date: '2026-12-24' })).toEqual(new Date(2026, 11, 24))
    expect(at({ when: 'inbox' })).toBeNull()
    expect(at({ when: 'date', date: 'soon' })).toBe('invalid')
  })

  it('reads each kind of repetition', () => {
    const repeat = (entries: Record<string, string>) => {
      const result = form({ title: 'x', ...entries })
      return result.ok ? recurrenceFrom(result.data) : 'invalid'
    }
    expect(repeat({ repeat: 'daily' })).toEqual({ kind: 'daily' })
    expect(repeat({ repeat: 'weekdays' })).toEqual({ kind: 'weekly', days: [1, 2, 3, 4, 5] })
    expect(repeat({ repeat: 'weekly', day1: 'on', day6: 'on' })).toEqual({ kind: 'weekly', days: [1, 6] })
    expect(repeat({ repeat: 'everyN', every: '3' })).toEqual({ kind: 'everyN', n: 3 })
    expect(repeat({ repeat: 'weekly' })).toBe('invalid')
    expect(repeat({ repeat: 'everyN', every: '0' })).toBe('invalid')
  })

  it('starts a repeating task today even when the inbox is chosen', () => {
    const result = form({ title: 'x', repeat: 'daily', when: 'inbox' })
    expect(result.ok && dueDateFrom(result.data, today)).toEqual(today)
  })
})
