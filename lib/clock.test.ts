import { describe, expect, it } from 'vitest'

import { isValidTimeZone, now, setClockZone, withClockZone, zonedNow } from './clock'

// One instant: 23:30 on 3 October 2026 in UTC.
const instant = new Date(Date.UTC(2026, 9, 3, 23, 30, 15))
const fields = (date: Date) => [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]

describe('zonedNow', () => {
  it('reads the clock of the given time zone', () => {
    // Abidjan is on UTC: still the 3rd, 23:30.
    expect(fields(zonedNow('Africa/Abidjan', instant))).toEqual([2026, 9, 3, 23, 30])
    // Paris is two hours ahead in October: already the 4th.
    expect(fields(zonedNow('Europe/Paris', instant))).toEqual([2026, 9, 4, 1, 30])
    // New York is four hours behind.
    expect(fields(zonedNow('America/New_York', instant))).toEqual([2026, 9, 3, 19, 30])
  })

  it('keeps the instant as it is without a usable time zone', () => {
    expect(zonedNow(null, instant)).toBe(instant)
    expect(zonedNow('Not/AZone', instant)).toBe(instant)
  })
})

describe('isValidTimeZone', () => {
  it('accepts real zones only', () => {
    expect(isValidTimeZone('Africa/Abidjan')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(null)).toBe(false)
  })
})

describe('now', () => {
  it('follows the zone set for the task, and keeps tasks apart', async () => {
    const hourIn = (timeZone: string) =>
      withClockZone(timeZone, async () => {
        // A pause, so the two tasks overlap.
        await new Promise((resolve) => setTimeout(resolve, 5))
        return now().getHours()
      })

    const [paris, newYork] = await Promise.all([hourIn('Europe/Paris'), hourIn('America/New_York')])
    const real = new Date()

    expect(paris).toBe(zonedNow('Europe/Paris', real).getHours())
    expect(newYork).toBe(zonedNow('America/New_York', real).getHours())
    expect(paris).not.toBe(newYork)
  })

  it('is set by a page for everything it calls afterwards, without reaching another request', async () => {
    const pause = () => new Promise((resolve) => setTimeout(resolve, 5))
    // What a use case does: some work, then asks the time.
    const askTheTime = async () => {
      await pause()
      return now().getHours()
    }
    // What a page or an action does: find out who is signed in, set the
    // clock, then call use cases.
    const request = async (timeZone: string) => {
      await pause()
      setClockZone(timeZone)
      await pause()
      return askTheTime()
    }

    const [paris, newYork, tokyo] = await Promise.all([
      request('Europe/Paris'),
      request('America/New_York'),
      request('Asia/Tokyo'),
    ])
    const real = new Date()

    expect(paris).toBe(zonedNow('Europe/Paris', real).getHours())
    expect(newYork).toBe(zonedNow('America/New_York', real).getHours())
    expect(tokyo).toBe(zonedNow('Asia/Tokyo', real).getHours())
  })
})
