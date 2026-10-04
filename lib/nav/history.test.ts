import { describe, expect, it } from 'vitest'

import { HISTORY_LIMIT, parseLastRoutes, parseStack, previousRoute, recordRoute, rememberRoute } from './history'

describe('recordRoute', () => {
  it('adds the routes reached by links', () => {
    expect(recordRoute(['/finance'], '/finance/chests', 'push')).toEqual(['/finance', '/finance/chests'])
  })

  it('ignores a route that is already the current one', () => {
    const stack = ['/finance']
    expect(recordRoute(stack, '/finance', 'push')).toBe(stack)
  })

  it('steps back when the browser returns to the previous route', () => {
    expect(recordRoute(['/finance', '/finance/chests'], '/finance', 'pop')).toEqual(['/finance'])
  })

  it('keeps a link back to the previous page as a new step', () => {
    expect(recordRoute(['/finance', '/finance/chests'], '/finance', 'push')).toEqual([
      '/finance',
      '/finance/chests',
      '/finance',
    ])
  })

  it('treats going forward as a new step', () => {
    expect(recordRoute(['/finance'], '/finance/review', 'pop')).toEqual(['/finance', '/finance/review'])
  })

  it('keeps only the most recent routes', () => {
    const long = Array.from({ length: HISTORY_LIMIT }, (_, i) => `/finance/history?page=${i}`)
    const next = recordRoute(long, '/finance', 'push')

    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next.at(-1)).toBe('/finance')
  })
})

describe('previousRoute', () => {
  it('is the route before the current one, if any', () => {
    expect(previousRoute(['/finance', '/finance/chests'])).toBe('/finance')
    expect(previousRoute(['/finance'])).toBeNull()
  })
})

describe('rememberRoute', () => {
  it('remembers a view of a node with its search params', () => {
    expect(rememberRoute({}, '/finance/history?period=week')).toEqual({ finance: '/finance/history?period=week' })
  })

  it('does not remember a page that is not a view', () => {
    const memory = { finance: '/finance/chests' }
    expect(rememberRoute(memory, '/finance/setup')).toBe(memory)
    expect(rememberRoute(memory, '/account')).toBe(memory)
  })
})

describe('reading storage', () => {
  it('keeps only valid routes, under the right node', () => {
    const raw = JSON.stringify({ finance: '/finance/goals', personal: '/finance/review', career: 42, nope: '/x' })
    expect(parseLastRoutes(raw)).toEqual({ finance: '/finance/goals' })
  })

  it('survives missing or broken storage', () => {
    expect(parseLastRoutes(null)).toEqual({})
    expect(parseLastRoutes('{oops')).toEqual({})
    expect(parseStack('[1, "/finance", "/account"]')).toEqual(['/finance'])
    expect(parseStack('nope')).toEqual([])
  })
})
