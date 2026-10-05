import { describe, expect, it } from 'vitest'

import { applyEdit, editableFields } from './edit'

describe('applyEdit', () => {
  it('puts the corrected amount in, keeping the rest', () => {
    expect(applyEdit('finance.addExpense', { amount: 5000, category: 'food', description: 'Lunch' }, { amount: '1 500' })).toEqual({
      ok: true,
      payload: { amount: 1500, category: 'food', description: 'Lunch' },
    })
  })

  it('clears an optional text left empty', () => {
    expect(applyEdit('finance.recordException', { category: 'food', reason: 'Guests' }, { reason: '  ' })).toEqual({
      ok: true,
      payload: { category: 'food', reason: null },
    })
  })

  it('refuses what the server would refuse', () => {
    expect(applyEdit('finance.saveRemaining', { amount: 100 }, { amount: '-3' }).ok).toBe(false)
    expect(applyEdit('personal.logSession', { minutes: 30 }, { minutes: '2000' }).ok).toBe(false)
    expect(applyEdit('personal.saveDailyNote', { body: 'Hi' }, { body: ' ' }).ok).toBe(false)
    expect(applyEdit('finance.transfer', {}, {}).ok).toBe(false)
  })

  it('has nothing to correct in a tick', () => {
    expect(editableFields('personal.toggleTask')).toEqual([])
  })
})
