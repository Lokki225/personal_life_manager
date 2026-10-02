import { AsyncLocalStorage } from 'node:async_hooks'

// The app's clock.
//
// Days belong to the person, not to the server: "today", "this month" and the
// moment a day turns over follow the time zone of whoever is signed in. Every
// date the app records for them (an expense, a movement) is written as the
// time on their own clock, so the rest of the code can keep comparing dates
// with the ordinary getters.
//
// `now()` is what "new Date()" should have been everywhere a day matters. The
// zone is set once per request, right after the signed-in user is known.

const zone = new AsyncLocalStorage<string | null>()

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// The date and time on a clock in `timeZone` at the instant `real`, as a Date
// whose own fields (getDate, getHours...) read that clock.
export function zonedNow(timeZone: string | null | undefined, real: Date = new Date()): Date {
  if (!isValidTimeZone(timeZone)) {
    return real
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(real)
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0)

  return new Date(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
    real.getMilliseconds(),
  )
}

// Sets whose clock `now()` reads for the rest of this request. It has to be
// called directly in the page or action, not inside a helper it awaits: the
// setting follows the code that called it, not the code that awaited it.
export function setClockZone(timeZone: string | null | undefined): void {
  zone.enterWith(isValidTimeZone(timeZone) ? timeZone : null)
}

// Runs `task` on the clock of one time zone. For jobs that go through several
// people in turn.
export function withClockZone<Result>(timeZone: string | null | undefined, task: () => Result): Result {
  return zone.run(isValidTimeZone(timeZone) ? timeZone : null, task)
}

// The current date and time for whoever this request is for.
export function now(): Date {
  return zonedNow(zone.getStore())
}
