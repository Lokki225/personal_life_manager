import { describe, expect, it } from 'vitest'

import { canOpen, getNode, lastRouteOf, NODES, nodeFromPath, viewFromPath } from './registry'

const finance = getNode('finance')
const personal = getNode('personal')

describe('the registry', () => {
  it('gives every node at most five views, including its default one', () => {
    for (const node of NODES) {
      expect(node.views.length).toBeLessThanOrEqual(5)
      expect(node.views.map((v) => v.id)).toContain(node.defaultView)
    }
  })
})

describe('nodeFromPath', () => {
  it('finds the node of a route, with or without search params', () => {
    expect(nodeFromPath('/finance')?.id).toBe('finance')
    expect(nodeFromPath('/finance/history?period=week')?.id).toBe('finance')
    expect(nodeFromPath('/personal/goals/abc')?.id).toBe('personal')
  })

  it('finds nothing outside the nodes, or on a path that only starts like one', () => {
    expect(nodeFromPath('/account')).toBeNull()
    expect(nodeFromPath('/financelike')).toBeNull()
  })
})

describe('viewFromPath', () => {
  it('groups the pages of a Finance section under its view', () => {
    expect(viewFromPath(finance, '/finance')?.id).toBe('today')
    expect(viewFromPath(finance, '/finance/today')?.id).toBe('today')
    expect(viewFromPath(finance, '/finance/goals')?.id).toBe('savings')
    expect(viewFromPath(finance, '/finance/debts')?.id).toBe('savings')
    expect(viewFromPath(finance, '/finance/history?period=week')?.id).toBe('review')
  })

  it('keeps detail pages under their view', () => {
    expect(viewFromPath(personal, '/personal/goals/abc')?.id).toBe('goals')
  })

  it('does not take every Finance page for Today', () => {
    expect(viewFromPath(finance, '/finance/setup')).toBeNull()
  })
})

describe('lastRouteOf', () => {
  it('reopens the remembered route, search params included', () => {
    expect(lastRouteOf(finance, '/finance/history?period=week')).toBe('/finance/history?period=week')
  })

  it('falls back to the default view when nothing valid is remembered', () => {
    expect(lastRouteOf(finance, undefined)).toBe('/finance')
    expect(lastRouteOf(finance, '/finance/setup')).toBe('/finance')
    expect(lastRouteOf(finance, '/personal/today')).toBe('/finance')
    expect(lastRouteOf(personal, '/personal/removed-view')).toBe('/personal/today')
  })
})

describe('canOpen', () => {
  it('lets administrators into nodes being built, and nobody into planned ones', () => {
    const building = { ...personal, access: 'admin' as const }

    expect(canOpen(finance, false)).toBe(true)
    expect(canOpen(building, true)).toBe(true)
    expect(canOpen(building, false)).toBe(false)
    expect(canOpen({ ...personal, access: 'none' }, true)).toBe(false)
  })
})
