import { describe, expect, it } from 'vitest'

import { safeCallbackUrl } from './callbackUrl'

describe('safeCallbackUrl', () => {
  it('keeps a same-site path', () => {
    expect(safeCallbackUrl('/finance/today')).toBe('/finance/today')
    expect(safeCallbackUrl(['/finance/goals', '/other'])).toBe('/finance/goals')
  })

  it('falls back to the finance overview when there is nothing useful', () => {
    expect(safeCallbackUrl(undefined)).toBe('/finance')
    expect(safeCallbackUrl('')).toBe('/finance')
    expect(safeCallbackUrl('/')).toBe('/finance')
    expect(safeCallbackUrl('/login')).toBe('/finance')
    expect(safeCallbackUrl('/login?callbackUrl=/login')).toBe('/finance')
  })

  it('rejects anything that could leave the site', () => {
    expect(safeCallbackUrl('https://evil.example')).toBe('/finance')
    expect(safeCallbackUrl('//evil.example')).toBe('/finance')
    expect(safeCallbackUrl('/\\evil.example')).toBe('/finance')
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/finance')
    expect(safeCallbackUrl('/\t/evil.example')).toBe('/finance')
    expect(safeCallbackUrl('/\n/evil.example')).toBe('/finance')
    expect(safeCallbackUrl('/.//evil.example')).toBe('/finance')
    expect(safeCallbackUrl('/' + 'a'.repeat(2001))).toBe('/finance')
  })

  it('keeps the query string of a deep link', () => {
    expect(safeCallbackUrl('/finance/history?period=week&type=expense')).toBe(
      '/finance/history?period=week&type=expense',
    )
  })
})
