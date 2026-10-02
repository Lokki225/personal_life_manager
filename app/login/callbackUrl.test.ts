import { describe, expect, it } from 'vitest'

import { safeCallbackUrl } from './callbackUrl'

describe('safeCallbackUrl', () => {
  it('keeps a same-site path', () => {
    expect(safeCallbackUrl('/finance/today')).toBe('/finance/today')
    expect(safeCallbackUrl(['/finance/goals', '/other'])).toBe('/finance/goals')
  })

  it('falls back to the guide when there is nothing useful', () => {
    expect(safeCallbackUrl(undefined)).toBe('/learn')
    expect(safeCallbackUrl('')).toBe('/learn')
    expect(safeCallbackUrl('/')).toBe('/learn')
    expect(safeCallbackUrl('/login')).toBe('/learn')
    expect(safeCallbackUrl('/finance')).toBe('/learn')
    expect(safeCallbackUrl('/signup')).toBe('/learn')
    expect(safeCallbackUrl('/login?callbackUrl=/login')).toBe('/learn')
  })

  it('rejects anything that could leave the site', () => {
    expect(safeCallbackUrl('https://evil.example')).toBe('/learn')
    expect(safeCallbackUrl('//evil.example')).toBe('/learn')
    expect(safeCallbackUrl('/\\evil.example')).toBe('/learn')
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/learn')
    expect(safeCallbackUrl('/\t/evil.example')).toBe('/learn')
    expect(safeCallbackUrl('/\n/evil.example')).toBe('/learn')
    expect(safeCallbackUrl('/.//evil.example')).toBe('/learn')
    expect(safeCallbackUrl('/' + 'a'.repeat(2001))).toBe('/learn')
  })

  it('keeps the query string of a deep link', () => {
    expect(safeCallbackUrl('/finance/history?period=week&type=expense')).toBe(
      '/finance/history?period=week&type=expense',
    )
  })
})
