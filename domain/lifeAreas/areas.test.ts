import { describe, expect, it } from 'vitest'

import { checkArea, moved } from './areas'

const input = (extra: object = {}) => ({ name: ' Tech ', statement: null, color: 'blue', icon: 'code', ...extra })

describe('life areas', () => {
  it('are named, once each, whatever the case', () => {
    expect(checkArea(input(), [])).toEqual({ name: 'Tech', statement: null, color: 'blue', icon: 'code' })
    expect(() => checkArea(input({ name: ' ' }), [])).toThrow(expect.objectContaining({ field: 'name' }))
    expect(() => checkArea(input(), [{ id: 'a', name: 'tech' }])).toThrow(expect.objectContaining({ field: 'name' }))
    // Renaming an area to its own name is fine.
    expect(checkArea(input(), [{ id: 'a', name: 'tech' }], 'a').name).toBe('Tech')
  })

  it('take colours and icons from the app’s lists only', () => {
    expect(() => checkArea(input({ color: 'red; background: url(x)' }), [])).toThrow(expect.objectContaining({ field: 'color' }))
    expect(() => checkArea(input({ icon: 'skull' }), [])).toThrow(expect.objectContaining({ field: 'icon' }))
    expect(checkArea(input({ color: '', icon: '' }), [])).toMatchObject({ color: null, icon: null })
  })

  it('move up and down, staying put at the ends', () => {
    expect(moved(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moved(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
    expect(moved(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c'])
    expect(moved(['a', 'b', 'c'], 'x', 'up')).toEqual(['a', 'b', 'c'])
  })
})
